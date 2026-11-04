import { ObjectId } from "mongodb";
import { json, handleError, requireRoles, readJson, HttpError } from "@/lib/api";
import { campsCol, ensureIndexes, nextSequence, type CampDoc } from "@/lib/models";
import { publicCamp } from "@/lib/serialize";
import { findLookup } from "@/lib/lookups";
import { notifyRoles, notifyUsers } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { syncCampToCalendar } from "@/lib/gcal";
import { cmNameMap, checkWhen, clip, resolveCmIds, whenText } from "@/lib/schedule";
import { istToday } from "@/lib/time";
import { getSettlement } from "@/lib/settlements";

export const runtime = "nodejs";

/** Camps. Office roles see all; a CM sees only the camps they are assigned to. */
export async function GET(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const p = new URL(req.url).searchParams;
    const and: Record<string, unknown>[] = [];
    if (user.role === "cm") and.push({ assignedCmIds: user._id });
    const status = p.get("status");
    if (status && ["scheduled", "cancelled", "completed"].includes(status)) and.push({ status });
    // "upcoming" = today onwards; "past" = before today.
    const when = p.get("when");
    if (when === "upcoming") and.push({ date: { $gte: istToday() } });
    if (when === "past") and.push({ date: { $lt: istToday() } });
    const from = p.get("from");
    const to = p.get("to");
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) and.push({ date: { $gte: from } });
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) and.push({ date: { $lte: to } });
    const type = p.get("type");
    if (type) and.push({ typeKey: type });
    const filter = and.length ? { $and: and } : {};

    const page = Math.max(Number(p.get("page")) || 1, 1);
    const pageSize = Math.min(Math.max(Number(p.get("pageSize")) || 25, 1), 100);
    const col = await campsCol();
    const [docs, total] = await Promise.all([
      col
        .find(filter)
        .sort({ date: when === "past" ? -1 : 1, startTime: 1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      col.countDocuments(filter),
    ]);
    const names = await cmNameMap([...new Set(docs.flatMap((c) => c.assignedCmIds.map(String)))].map((i) => new ObjectId(i)));
    return json({
      camps: docs.map((c) => publicCamp(c, { cmNames: names })),
      total,
      page,
      pageSize,
      pages: Math.max(Math.ceil(total / pageSize), 1),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** MIS, PM (and Director) create a camp: notify everyone concerned and add it to Google Calendar. */
export async function POST(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager");
    await ensureIndexes();
    const body = await readJson<Record<string, unknown>>(req);

    const name = clip(body.name, 120);
    if (!name) throw new HttpError(400, "Give the camp a name");
    const venue = clip(body.venue, 200);
    if (!venue) throw new HttpError(400, "Enter the venue");
    const type = await findLookup("camp_type", clip(body.typeKey, 60));
    if (!type) throw new HttpError(400, "Choose a camp type");
    const when = checkWhen(body);
    if (when.date < istToday()) throw new HttpError(400, "The camp date cannot be in the past");
    const assignedCmIds = await resolveCmIds(body.assignedCmIds);
    const settlementCode = clip(body.settlementCode, 60) || undefined;
    if (settlementCode && !(await getSettlement(settlementCode))) {
      throw new HttpError(400, "Choose a valid community");
    }

    const now = new Date();
    const seq = await nextSequence("camp");
    const doc: CampDoc = {
      campCode: `CMP-${String(seq).padStart(4, "0")}`,
      name,
      typeKey: type.key,
      typeLabel: type.label,
      description: clip(body.description, 2000) || undefined,
      ...when,
      venue,
      settlementCode,
      programme: clip(body.programme, 120) || undefined,
      responsibleName: clip(body.responsibleName, 120) || undefined,
      assignedCmIds,
      instructions: clip(body.instructions, 2000) || undefined,
      status: "scheduled",
      calendar: { status: "pending", attempts: 0 },
      history: [{ at: now, by: user.name, note: "Camp created" }],
      createdBy: user._id!,
      createdByName: user.name,
      createdByRole: user.role,
      createdAt: now,
      updatedAt: now,
    };
    const res = await (await campsCol()).insertOne(doc);
    const id = res.insertedId;

    const text = `${name} (${type.label}) · ${whenText(when.date, when.startTime, when.endTime)} · ${venue}`;
    const event = {
      category: "camp_created" as const,
      title: `New camp · ${doc.campCode}`,
      body: text,
      relatedType: "camp" as const,
      relatedId: String(id),
      dedupeKey: `camp_created:${id}`,
    };
    await Promise.all([
      notifyUsers(assignedCmIds, { ...event, body: `You are assigned: ${text}` }),
      notifyRoles(["mis", "programme_manager", "director"], { ...event, body: `${user.name} scheduled: ${text}` }, { excludeUserId: user._id }),
    ]);
    await audit({ actor: user, action: "camp.created", entityType: "camp", entityId: String(id), ref: doc.campCode, summary: `Camp created: ${name}` });

    const calendar = await syncCampToCalendar(id);
    const saved = (await (await campsCol()).findOne({ _id: id }))!;
    const names = await cmNameMap(assignedCmIds);
    return json({ camp: publicCamp(saved, { cmNames: names }), calendar }, 201);
  } catch (e) {
    return handleError(e);
  }
}
