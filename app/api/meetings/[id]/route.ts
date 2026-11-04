import { json, handleError, requireRoles, readJson, HttpError } from "@/lib/api";
import { meetingsCol } from "@/lib/models";
import { publicMeeting } from "@/lib/serialize";
import { findLookup } from "@/lib/lookups";
import { notifyRoles, notifyUsers } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { cmNameMap, checkWhen, clip, oidOr400, resolveCmIds, whenText } from "@/lib/schedule";
import { getSettlement } from "@/lib/settlements";

export const runtime = "nodejs";

async function load(id: string) {
  const m = await (await meetingsCol()).findOne({ _id: oidOr400(id, "meeting id") });
  if (!m) throw new HttpError(404, "Meeting not found");
  return m;
}
const involves = (m: { organiserCmId: unknown; taggedCmIds: unknown[] }, uid: unknown) =>
  String(m.organiserCmId) === String(uid) || m.taggedCmIds.some((i) => String(i) === String(uid));

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const m = await load((await ctx.params).id);
    if (user.role === "cm" && !involves(m, user._id)) throw new HttpError(404, "Meeting not found");
    const names = await cmNameMap(m.taggedCmIds);
    return json({ meeting: publicMeeting(m, { cmNames: names }) });
  } catch (e) {
    return handleError(e);
  }
}

/** Only the organising CM edits or cancels a meeting. Everyone involved is told. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("cm");
    const m = await load((await ctx.params).id);
    if (String(m.organiserCmId) !== String(user._id)) {
      throw new HttpError(403, "Only the organiser can change this meeting");
    }
    if (m.status === "cancelled") throw new HttpError(409, "This meeting is cancelled");
    const body = await readJson<Record<string, unknown>>(req);

    const now = new Date();
    const set: Record<string, unknown> = { updatedAt: now };
    let note: string;
    let cancelled = false;

    if (body.action === "cancel") {
      set.status = "cancelled";
      cancelled = true;
      const why = clip(body.reason, 300);
      note = why ? `Meeting cancelled: ${why}` : "Meeting cancelled";
    } else if (body.action === "complete") {
      set.status = "completed";
      note = "Marked completed";
    } else {
      const changes: string[] = [];
      if (body.title !== undefined) {
        const v = clip(body.title, 140);
        if (!v) throw new HttpError(400, "Give the meeting a title");
        set.title = v;
        changes.push("title");
      }
      if (body.location !== undefined) {
        const v = clip(body.location, 200);
        if (!v) throw new HttpError(400, "Enter where the meeting will be");
        set.location = v;
        changes.push("location");
      }
      if (body.typeKey !== undefined) {
        const t = await findLookup("meeting_type", clip(body.typeKey, 60));
        if (!t) throw new HttpError(400, "Choose a meeting type");
        set.typeKey = t.key;
        set.typeLabel = t.label;
        changes.push("type");
      }
      if (body.date !== undefined || body.startTime !== undefined || body.endTime !== undefined) {
        Object.assign(
          set,
          checkWhen({
            date: body.date ?? m.date,
            startTime: body.startTime ?? m.startTime,
            endTime: body.endTime ?? m.endTime,
          })
        );
        changes.push("date/time");
      }
      for (const [k, max] of [["description", 2000], ["agenda", 3000], ["notes", 2000]] as const) {
        if (body[k] !== undefined) {
          set[k] = clip(body[k], max) || undefined;
          changes.push(k);
        }
      }
      if (body.settlementCode !== undefined) {
        const c = clip(body.settlementCode, 60) || undefined;
        if (c && !(await getSettlement(c))) throw new HttpError(400, "Choose a valid community");
        set.settlementCode = c;
        changes.push("community");
      }
      if (body.taggedCmIds !== undefined) {
        set.taggedCmIds = await resolveCmIds(body.taggedCmIds, user._id);
        changes.push("tagged CMs");
      }
      if (!changes.length) throw new HttpError(400, "Nothing to change");
      note = `Updated: ${changes.join(", ")}`;
    }

    const col = await meetingsCol();
    await col.updateOne(
      { _id: m._id },
      { $set: set, $push: { history: { at: now, by: user.name, note } } } as never
    );
    const updated = (await col.findOne({ _id: m._id }))!;

    const before = new Set(m.taggedCmIds.map(String));
    const newlyTagged = updated.taggedCmIds.filter((i) => !before.has(String(i)));
    const text = `${updated.title} (${updated.typeLabel}) · ${whenText(updated.date, updated.startTime, updated.endTime)} · ${updated.location}`;
    const event = {
      category: "meeting_updated" as const,
      title: `${cancelled ? "Meeting cancelled" : "Meeting updated"} · ${updated.meetingCode}`,
      body: `${user.name}: ${note}. ${text}`,
      relatedType: "meeting" as const,
      relatedId: String(m._id),
      dedupeKey: `meeting_updated:${m._id}:${now.getTime()}`,
    };
    await Promise.all([
      // Everyone tagged before or after the change, plus the office.
      notifyUsers(
        [...m.taggedCmIds, ...updated.taggedCmIds].filter(
          (i) => !newlyTagged.some((n) => String(n) === String(i))
        ),
        event,
        { excludeUserId: user._id }
      ),
      notifyRoles(["mis", "programme_manager", "director"], event),
      // New helpers get an invitation too.
      notifyUsers(newlyTagged, {
        category: "meeting_invited",
        title: `You are tagged on a meeting · ${updated.meetingCode}`,
        body: `${user.name} asked for your help: ${text}`,
        relatedType: "meeting",
        relatedId: String(m._id),
        dedupeKey: `meeting_invited:${m._id}`,
      }),
    ]);
    await audit({ actor: user, action: cancelled ? "meeting.cancelled" : "meeting.updated", entityType: "meeting", entityId: String(m._id), ref: updated.meetingCode, summary: note });

    return json({ meeting: publicMeeting(updated, { cmNames: await cmNameMap(updated.taggedCmIds) }) });
  } catch (e) {
    return handleError(e);
  }
}
