import { json, handleError, requireRoles, readJson, HttpError } from "@/lib/api";
import { supportRecordsCol, casesCol } from "@/lib/models";
import { publicSupportRecord } from "@/lib/serialize";
import { audit } from "@/lib/audit";
import { oidOr400 } from "@/lib/schedule";
import { cleanInput, linkSupportRecord } from "@/lib/support/service";
import { matchRecord } from "@/lib/support/match";

export const runtime = "nodejs";

async function load(id: string) {
  const r = await (await supportRecordsCol()).findOne({ _id: oidOr400(id, "record id") });
  if (!r) throw new HttpError(404, "Record not found");
  return r;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const r = await load((await ctx.params).id);
    if (user.role === "cm" && String(r.cmId) !== String(user._id)) throw new HttpError(404, "Record not found");
    return json({ record: publicSupportRecord(r) });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * MIS / PM / Director: correct any field, or confirm which case a record belongs to
 * ({action:"link", caseId, close?}), or ask for fresh suggestions ({action:"suggest"}).
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager");
    const r = await load((await ctx.params).id);
    const body = await readJson<Record<string, unknown>>(req);
    const col = await supportRecordsCol();
    const now = new Date();

    if (body.action === "link") {
      if (!body.caseId) throw new HttpError(400, "Choose the case");
      const out = await linkSupportRecord(user, r._id!, String(body.caseId), body.close === true, body.force === true);
      return json({ record: publicSupportRecord((await col.findOne({ _id: r._id }))!), ...out });
    }
    if (body.action === "unlink") {
      await col.updateOne({ _id: r._id }, { $unset: { caseId: "", caseCode: "", householdId: "" }, $set: { linkStatus: "unlinked", updatedAt: now }, $push: { history: { at: now, by: user.name, note: "Unlinked from case" } } } as never);
      return json({ record: publicSupportRecord((await col.findOne({ _id: r._id }))!) });
    }
    if (body.action === "suggest") {
      const m = await matchRecord({ settlementCode: r.settlementCode, referral: r.referral, beneficiaryName: r.beneficiaryName, typeKeys: r.supportTypes });
      await col.updateOne({ _id: r._id }, { $set: { suggestions: m.suggestions, linkStatus: r.caseId ? "linked" : m.suggestions.length ? "suggested" : "unlinked", updatedAt: now } });
      return json({ record: publicSupportRecord((await col.findOne({ _id: r._id }))!) });
    }

    // Field corrections: merge over the current values and re-validate the whole record.
    const merged = {
      supportDate: r.supportDate, settlementCode: r.settlementCode, referral: r.referral, beneficiaryName: r.beneficiaryName,
      phone: r.phone, supportTypes: r.supportTypes, details: r.details, photoLinks: r.photoLinks, status: r.status, remarks: r.remarks,
      ...Object.fromEntries(Object.entries(body).filter(([k]) => k !== "action" && k !== "caseId")),
    };
    // Changing the referral changes the page: drop answers and types that no longer apply unless re-sent.
    if (body.referral !== undefined && body.referral !== r.referral) {
      if (body.supportTypes === undefined) throw new HttpError(400, "Choose the type of support for the new referral");
      if (body.details === undefined) merged.details = {};
    }
    const clean = await cleanInput(merged);
    const changed = (Object.keys(clean) as (keyof typeof clean)[]).filter((k) => JSON.stringify(clean[k]) !== JSON.stringify((r as unknown as Record<string, unknown>)[k]));
    if (!changed.length) throw new HttpError(400, "Nothing to change");
    await col.updateOne(
      { _id: r._id },
      { $set: { ...clean, updatedAt: now }, $push: { history: { at: now, by: user.name, note: `Edited: ${changed.join(", ")}` } } } as never
    );
    await audit({ actor: user, action: "support_record.edited", entityType: "support_record", entityId: String(r._id), ref: r.caseCode ?? r.communityName, summary: `Edited: ${changed.join(", ")}` });
    return json({ record: publicSupportRecord((await col.findOne({ _id: r._id }))!) });
  } catch (e) {
    return handleError(e);
  }
}

/** Director only — duplicates and test entries. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("director");
    const r = await load((await ctx.params).id);
    await (await supportRecordsCol()).deleteOne({ _id: r._id });
    await audit({ actor: user, action: "support_record.deleted", entityType: "support_record", entityId: String(r._id), ref: r.caseCode ?? r.communityName, summary: "Support record deleted" });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export { casesCol };
