import { json, handleError, requireRoles, readJson, HttpError } from "@/lib/api";
import { meetingRecordsCol } from "@/lib/models";
import { publicMeetingRecord } from "@/lib/serialize";
import { findLookup } from "@/lib/lookups";
import { getSettlement } from "@/lib/settlements";
import { audit } from "@/lib/audit";
import { clip, oidOr400 } from "@/lib/schedule";
import { istToday } from "@/lib/time";
import { checkMeetingDate, cleanTopic, parseLinks, parseParticipants } from "@/lib/meeting-records";

export const runtime = "nodejs";

async function load(id: string) {
  const r = await (await meetingRecordsCol()).findOne({ _id: oidOr400(id, "record id") });
  if (!r) throw new HttpError(404, "Meeting report not found");
  return r;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const r = await load((await ctx.params).id);
    if (user.role === "cm" && String(r.cmId) !== String(user._id)) {
      throw new HttpError(404, "Meeting report not found");
    }
    return json({ record: publicMeetingRecord(r) });
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
    const changed: string[] = [];
    if (body.meetingDate !== undefined) {
      set.meetingDate = checkMeetingDate(body.meetingDate, istToday());
      changed.push("date");
    }
    if (body.settlementCode !== undefined) {
      const s = await getSettlement(clip(body.settlementCode, 60));
      if (!s) throw new HttpError(400, "Choose the community");
      set.settlementCode = s.code;
      set.communityName = s.label;
      changed.push("community");
    }
    if (body.typeKey !== undefined) {
      const t = await findLookup("meeting_form_type", clip(body.typeKey, 80));
      if (!t) throw new HttpError(400, "Choose the type of meeting");
      set.typeKey = t.key;
      set.typeLabel = t.label;
      changed.push("type");
    }
    if (body.topic !== undefined) {
      set.topic = cleanTopic(body.topic);
      changed.push("topic");
    }
    if (body.totalParticipants !== undefined) {
      set.totalParticipants = parseParticipants(body.totalParticipants);
      changed.push("participants");
    }
    if (body.attendanceLinks !== undefined) {
      set.attendanceLinks = parseLinks(body.attendanceLinks, "Attendance sheet");
      changed.push("attendance links");
    }
    if (body.photoLinks !== undefined) {
      set.photoLinks = parseLinks(body.photoLinks, "Group photo");
      changed.push("photo links");
    }
    if (body.remarks !== undefined) {
      set.remarks = clip(body.remarks, 4000) || undefined;
      changed.push("remarks");
    }
    if (!changed.length) throw new HttpError(400, "Nothing to change");

    const now = new Date();
    set.updatedAt = now;
    const col = await meetingRecordsCol();
    await col.updateOne(
      { _id: r._id },
      { $set: set, $push: { history: { at: now, by: user.name, note: `Edited: ${changed.join(", ")}` } } } as never
    );
    await audit({
      actor: user,
      action: "meeting_record.edited",
      entityType: "meeting_record",
      entityId: String(r._id),
      ref: `${r.communityName} ${r.meetingDate}`,
      summary: `Edited: ${changed.join(", ")}`,
    });
    return json({ record: publicMeetingRecord((await col.findOne({ _id: r._id }))!) });
  } catch (e) {
    return handleError(e);
  }
}

/** Director only — for duplicates and test entries. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("director");
    const r = await load((await ctx.params).id);
    await (await meetingRecordsCol()).deleteOne({ _id: r._id });
    await audit({
      actor: user,
      action: "meeting_record.deleted",
      entityType: "meeting_record",
      entityId: String(r._id),
      ref: `${r.communityName} ${r.meetingDate}`,
      summary: "Meeting report deleted",
    });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
