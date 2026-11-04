import { ObjectId } from "mongodb";
import { json, handleError, requireRoles, readJson, HttpError } from "@/lib/api";
import { meetingsCol, ensureIndexes, nextSequence, type MeetingDoc } from "@/lib/models";
import { publicMeeting } from "@/lib/serialize";
import { findLookup } from "@/lib/lookups";
import { notifyRoles, notifyUsers } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { cmNameMap, checkWhen, clip, resolveCmIds, whenText } from "@/lib/schedule";
import { istToday } from "@/lib/time";
import { getSettlement } from "@/lib/settlements";

export const runtime = "nodejs";

/** Meetings. Office roles see all; a CM sees the ones they organise or are tagged on. */
export async function GET(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const p = new URL(req.url).searchParams;
    const and: Record<string, unknown>[] = [];
    if (user.role === "cm") and.push({ $or: [{ organiserCmId: user._id }, { taggedCmIds: user._id }] });
    const status = p.get("status");
    if (status && ["scheduled", "cancelled", "completed"].includes(status)) and.push({ status });
    const when = p.get("when");
    if (when === "upcoming") and.push({ date: { $gte: istToday() } });
    if (when === "past") and.push({ date: { $lt: istToday() } });
    const from = p.get("from");
    const to = p.get("to");
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) and.push({ date: { $gte: from } });
    if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) and.push({ date: { $lte: to } });
    const filter = and.length ? { $and: and } : {};

    const page = Math.max(Number(p.get("page")) || 1, 1);
    const pageSize = Math.min(Math.max(Number(p.get("pageSize")) || 25, 1), 100);
    const col = await meetingsCol();
    const [docs, total] = await Promise.all([
      col
        .find(filter)
        .sort({ date: when === "past" ? -1 : 1, startTime: 1, _id: 1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      col.countDocuments(filter),
    ]);
    const names = await cmNameMap([...new Set(docs.flatMap((m) => m.taggedCmIds.map(String)))].map((i) => new ObjectId(i)));
    return json({
      meetings: docs.map((m) => publicMeeting(m, { cmNames: names })),
      total,
      page,
      pageSize,
      pages: Math.max(Math.ceil(total / pageSize), 1),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** A CM creates a community meeting and tags any number of other CMs to help. */
export async function POST(req: Request) {
  try {
    const user = await requireRoles("cm");
    await ensureIndexes();
    const body = await readJson<Record<string, unknown>>(req);

    const title = clip(body.title, 140);
    if (!title) throw new HttpError(400, "Give the meeting a title");
    const location = clip(body.location, 200);
    if (!location) throw new HttpError(400, "Enter where the meeting will be");
    const type = await findLookup("meeting_type", clip(body.typeKey, 60));
    if (!type) throw new HttpError(400, "Choose a meeting type");
    const when = checkWhen(body);
    if (when.date < istToday()) throw new HttpError(400, "The meeting date cannot be in the past");
    const taggedCmIds = await resolveCmIds(body.taggedCmIds, user._id);
    const settlementCode = clip(body.settlementCode, 60) || undefined;
    if (settlementCode && !(await getSettlement(settlementCode))) {
      throw new HttpError(400, "Choose a valid community");
    }
    const expected = body.expectedParticipants === undefined || body.expectedParticipants === "" ? undefined : Number(body.expectedParticipants);
    if (expected !== undefined && (!Number.isInteger(expected) || expected < 0 || expected > 100000)) {
      throw new HttpError(400, "Expected participants must be a whole number");
    }

    const now = new Date();
    const seq = await nextSequence("meeting");
    const doc: MeetingDoc = {
      meetingCode: `MTG-${String(seq).padStart(4, "0")}`,
      title,
      typeKey: type.key,
      typeLabel: type.label,
      description: clip(body.description, 2000) || undefined,
      ...when,
      location,
      settlementCode,
      agenda: clip(body.agenda, 3000) || undefined,
      expectedParticipants: expected,
      notes: clip(body.notes, 2000) || undefined,
      organiserCmId: user._id!,
      organiserName: user.name,
      taggedCmIds,
      status: "scheduled",
      history: [{ at: now, by: user.name, note: "Meeting created" }],
      createdAt: now,
      updatedAt: now,
    };
    const res = await (await meetingsCol()).insertOne(doc);
    const id = res.insertedId;

    const names = await cmNameMap(taggedCmIds);
    const taggedList = taggedCmIds.map((i) => names[String(i)]).filter(Boolean).join(", ");
    const text = `${title} (${type.label}) · ${whenText(when.date, when.startTime, when.endTime)} · ${location}`;
    await Promise.all([
      notifyRoles(["mis", "programme_manager", "director"], {
        category: "meeting_created",
        title: `New community meeting · ${doc.meetingCode}`,
        body: `${user.name} organised: ${text}${taggedList ? `. Tagged: ${taggedList}` : ""}`,
        relatedType: "meeting",
        relatedId: String(id),
        dedupeKey: `meeting_created:${id}`,
      }),
      notifyUsers(taggedCmIds, {
        category: "meeting_invited",
        title: `You are tagged on a meeting · ${doc.meetingCode}`,
        body: `${user.name} asked for your help: ${text}`,
        relatedType: "meeting",
        relatedId: String(id),
        dedupeKey: `meeting_invited:${id}`,
      }),
    ]);
    await audit({ actor: user, action: "meeting.created", entityType: "meeting", entityId: String(id), ref: doc.meetingCode, summary: `Meeting created: ${title}`, meta: { tagged: taggedCmIds.length } });

    return json({ meeting: publicMeeting({ ...doc, _id: id }, { cmNames: names }) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
