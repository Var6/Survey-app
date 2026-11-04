import { json, handleError, requireRoles, readJson, HttpError } from "@/lib/api";
import { visitRecordsCol, type VisitedType } from "@/lib/models";
import { publicVisitRecord } from "@/lib/serialize";
import { getSettlement } from "@/lib/settlements";
import { audit } from "@/lib/audit";
import { clip, oidOr400 } from "@/lib/schedule";
import { istToday } from "@/lib/time";
import { parseLinks } from "@/lib/meeting-records";
import {
  ALL_CONTACT_FIELDS,
  CONTACT_FIELDS,
  checkVisitDate,
  cleanContact,
  cleanDiscussion,
  parseVisitedType,
  requireContacts,
} from "@/lib/visit-records";

export const runtime = "nodejs";

async function load(id: string) {
  const r = await (await visitRecordsCol()).findOne({ _id: oidOr400(id, "record id") });
  if (!r) throw new HttpError(404, "Visit report not found");
  return r;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const r = await load((await ctx.params).id);
    if (user.role === "cm" && String(r.cmId) !== String(user._id)) {
      throw new HttpError(404, "Visit report not found");
    }
    return json({ record: publicVisitRecord(r) });
  } catch (e) {
    return handleError(e);
  }
}

/** MIS, Programme Manager and Director correct any field. Every change is written to the record's history. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager");
    const r = await load((await ctx.params).id);
    const body = await readJson<Record<string, unknown>>(req);

    const set: Record<string, unknown> = {};
    const unset: Record<string, ""> = {};
    const changed: string[] = [];
    if (body.visitDate !== undefined) {
      set.visitDate = checkVisitDate(body.visitDate, istToday());
      changed.push("date");
    }
    if (body.settlementCode !== undefined) {
      const s = await getSettlement(clip(body.settlementCode, 60));
      if (!s) throw new HttpError(400, "Choose the tola / community");
      set.settlementCode = s.code;
      set.communityName = s.label;
      changed.push("community");
    }
    if (body.stakeholderNames !== undefined) {
      const v = clip(body.stakeholderNames, 400);
      if (v) set.stakeholderNames = v;
      else unset.stakeholderNames = "";
      changed.push("people met");
    }
    if (body.discussion !== undefined) {
      set.discussion = cleanDiscussion(body.discussion);
      changed.push("discussion");
    }
    if (body.photoLinks !== undefined) {
      set.photoLinks = parseLinks(body.photoLinks, "Photo");
      changed.push("photo links");
    }
    if (body.remarks !== undefined) {
      const v = clip(body.remarks, 4000);
      if (v) set.remarks = v;
      else unset.remarks = "";
      changed.push("remarks");
    }

    // The contact block belongs to the kind of visit: changing the kind swaps the block.
    const type: VisitedType = body.visitedType !== undefined ? parseVisitedType(body.visitedType) : r.visitedType;
    const touchesContacts =
      type !== r.visitedType || ALL_CONTACT_FIELDS.some((k) => body[k as string] !== undefined);
    if (touchesContacts) {
      const merged = cleanContact({ ...r, ...body }, type);
      requireContacts(type, merged);
      for (const k of ALL_CONTACT_FIELDS) {
        if (CONTACT_FIELDS[type].includes(k) && merged[k]) set[k] = merged[k];
        else if (r[k] !== undefined) unset[k as string] = "";
      }
      if (type !== r.visitedType) {
        set.visitedType = type;
        changed.push("kind of visit");
      }
      changed.push("contact details");
    }
    if (!changed.length) throw new HttpError(400, "Nothing to change");

    const now = new Date();
    set.updatedAt = now;
    const col = await visitRecordsCol();
    await col.updateOne(
      { _id: r._id },
      {
        $set: set,
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
        $push: { history: { at: now, by: user.name, note: `Edited: ${changed.join(", ")}` } },
      } as never
    );
    await audit({
      actor: user,
      action: "visit_record.edited",
      entityType: "visit_record",
      entityId: String(r._id),
      ref: `${r.communityName} ${r.visitDate}`,
      summary: `Edited: ${changed.join(", ")}`,
    });
    return json({ record: publicVisitRecord((await col.findOne({ _id: r._id }))!) });
  } catch (e) {
    return handleError(e);
  }
}

/** Director only — for duplicates and test entries. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("director");
    const r = await load((await ctx.params).id);
    await (await visitRecordsCol()).deleteOne({ _id: r._id });
    await audit({
      actor: user,
      action: "visit_record.deleted",
      entityType: "visit_record",
      entityId: String(r._id),
      ref: `${r.communityName} ${r.visitDate}`,
      summary: "Report deleted",
    });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
