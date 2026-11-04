import { json, handleError, requireRoles, readJson, HttpError } from "@/lib/api";
import { campsCol } from "@/lib/models";
import { publicCamp } from "@/lib/serialize";
import { findLookup } from "@/lib/lookups";
import { notifyRoles, notifyUsers } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { syncCampToCalendar } from "@/lib/gcal";
import { cmNameMap, checkWhen, clip, oidOr400, resolveCmIds, whenText } from "@/lib/schedule";
import { getSettlement } from "@/lib/settlements";

export const runtime = "nodejs";

async function load(id: string) {
  const camp = await (await campsCol()).findOne({ _id: oidOr400(id, "camp id") });
  if (!camp) throw new HttpError(404, "Camp not found");
  return camp;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const camp = await load((await ctx.params).id);
    if (user.role === "cm" && !camp.assignedCmIds.some((i) => String(i) === String(user._id))) {
      throw new HttpError(404, "Camp not found");
    }
    const names = await cmNameMap(camp.assignedCmIds);
    return json({ camp: publicCamp(camp, { cmNames: names }) });
  } catch (e) {
    return handleError(e);
  }
}

/** Edit a camp, or cancel it with { action: "cancel" }. Everyone affected is notified and the calendar event follows. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager");
    const camp = await load((await ctx.params).id);
    const body = await readJson<Record<string, unknown>>(req);
    if (camp.status === "cancelled") throw new HttpError(409, "This camp is cancelled");

    const now = new Date();
    const set: Record<string, unknown> = { updatedAt: now };
    let note: string;
    let cancelled = false;

    if (body.action === "cancel") {
      set.status = "cancelled";
      cancelled = true;
      const why = clip(body.reason, 300);
      note = why ? `Camp cancelled: ${why}` : "Camp cancelled";
    } else if (body.action === "complete") {
      set.status = "completed";
      note = "Marked completed";
    } else {
      const changes: string[] = [];
      if (body.name !== undefined) {
        const v = clip(body.name, 120);
        if (!v) throw new HttpError(400, "Give the camp a name");
        set.name = v;
        changes.push("name");
      }
      if (body.venue !== undefined) {
        const v = clip(body.venue, 200);
        if (!v) throw new HttpError(400, "Enter the venue");
        set.venue = v;
        changes.push("venue");
      }
      if (body.typeKey !== undefined) {
        const t = await findLookup("camp_type", clip(body.typeKey, 60));
        if (!t) throw new HttpError(400, "Choose a camp type");
        set.typeKey = t.key;
        set.typeLabel = t.label;
        changes.push("type");
      }
      if (body.date !== undefined || body.startTime !== undefined || body.endTime !== undefined) {
        const when = checkWhen({
          date: body.date ?? camp.date,
          startTime: body.startTime ?? camp.startTime,
          endTime: body.endTime ?? camp.endTime,
        });
        Object.assign(set, when);
        changes.push("date/time");
      }
      for (const [k, max] of [["description", 2000], ["instructions", 2000], ["programme", 120], ["responsibleName", 120]] as const) {
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
      if (body.assignedCmIds !== undefined) {
        set.assignedCmIds = await resolveCmIds(body.assignedCmIds);
        changes.push("assigned CMs");
      }
      if (!changes.length) throw new HttpError(400, "Nothing to change");
      note = `Updated: ${changes.join(", ")}`;
    }

    const col = await campsCol();
    await col.updateOne(
      { _id: camp._id },
      { $set: set, $push: { history: { at: now, by: user.name, note } } } as never
    );
    const updated = (await col.findOne({ _id: camp._id }))!;

    // Affected = everyone assigned before or after the change, plus the office.
    const affected = [...camp.assignedCmIds, ...updated.assignedCmIds];
    const text = `${updated.name} (${updated.typeLabel}) · ${whenText(updated.date, updated.startTime, updated.endTime)} · ${updated.venue}`;
    const event = {
      category: "camp_updated" as const,
      title: `${cancelled ? "Camp cancelled" : "Camp updated"} · ${updated.campCode}`,
      body: `${note}. ${text}`,
      relatedType: "camp" as const,
      relatedId: String(camp._id),
      dedupeKey: `camp_updated:${camp._id}:${now.getTime()}`,
    };
    await Promise.all([
      notifyUsers(affected, event, { excludeUserId: user._id }),
      notifyRoles(["mis", "programme_manager", "director"], event, { excludeUserId: user._id }),
    ]);
    await audit({ actor: user, action: cancelled ? "camp.cancelled" : "camp.updated", entityType: "camp", entityId: String(camp._id), ref: updated.campCode, summary: note });

    await syncCampToCalendar(camp._id!);
    const saved = (await col.findOne({ _id: camp._id }))!;
    const names = await cmNameMap(saved.assignedCmIds);
    return json({ camp: publicCamp(saved, { cmNames: names }) });
  } catch (e) {
    return handleError(e);
  }
}
