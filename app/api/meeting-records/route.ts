import { json, handleError, requireRoles, readJson, HttpError } from "@/lib/api";
import { meetingRecordsCol, ensureIndexes, type MeetingRecordDoc } from "@/lib/models";
import { publicMeetingRecord } from "@/lib/serialize";
import { findLookup } from "@/lib/lookups";
import { getSettlement } from "@/lib/settlements";
import { notifyRoles } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { clip } from "@/lib/schedule";
import { istToday } from "@/lib/time";
import {
  TYPE_LIST,
  buildRecordFilter,
  checkMeetingDate,
  cleanTopic,
  kindOf,
  parseLinks,
  parseParticipants,
} from "@/lib/meeting-records";

export const runtime = "nodejs";

/**
 * Meeting reports (the old Google Form). Office roles see all of them; a CM
 * sees only the ones they filled in. Paged on the server, 100 a page.
 */
export async function GET(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const p = new URL(req.url).searchParams;
    const filter = buildRecordFilter(user, p);
    const page = Math.max(Number(p.get("page")) || 1, 1);
    const pageSize = Math.min(Math.max(Number(p.get("pageSize")) || 100, 1), 200);

    const col = await meetingRecordsCol();
    const [docs, total, byType, sum, byStakeholder] = await Promise.all([
      col
        .find(filter)
        .sort({ meetingDate: -1, submittedAt: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      col.countDocuments(filter),
      // Summary of the WHOLE filtered set, not just this page.
      col
        .aggregate<{ _id: string; label: string; n: number; people: number }>([
          { $match: filter },
          { $group: { _id: "$typeKey", label: { $first: "$typeLabel" }, n: { $sum: 1 }, people: { $sum: "$totalParticipants" } } },
          { $sort: { n: -1 } },
        ])
        .toArray(),
      col
        .aggregate<{ _id: null; people: number; noEvidence: number }>([
          { $match: filter },
          {
            $group: {
              _id: null,
              people: { $sum: "$totalParticipants" },
              noEvidence: {
                $sum: {
                  $cond: [
                    { $or: [{ $eq: [{ $size: { $ifNull: ["$attendanceLinks", []] } }, 0] }, { $eq: [{ $size: { $ifNull: ["$photoLinks", []] } }, 0] }] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ])
        .toArray(),
      // Camp reports: who supported them (Government / NGO …).
      col
        .aggregate<{ _id: string; label: string; n: number }>([
          { $match: { $and: [filter, { stakeholderType: { $exists: true } }] } },
          { $group: { _id: "$stakeholderType", label: { $first: "$stakeholderTypeLabel" }, n: { $sum: 1 } } },
          { $sort: { n: -1 } },
        ])
        .toArray(),
    ]);
    return json({
      records: docs.map(publicMeetingRecord),
      total,
      page,
      pageSize,
      pages: Math.max(Math.ceil(total / pageSize), 1),
      summary: {
        meetings: total,
        participants: sum[0]?.people ?? 0,
        missingEvidence: sum[0]?.noEvidence ?? 0,
        byType: byType.map((t) => ({ key: t._id, label: t.label, meetings: t.n, participants: t.people })),
        byStakeholder: byStakeholder.map((t) => ({ key: t._id, label: t.label, count: t.n })),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

/** A CM files a meeting report. (Office roles may also enter one on a CM's behalf.) */
export async function POST(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    await ensureIndexes();
    const body = await readJson<Record<string, unknown>>(req);

    const kind = kindOf(body.kind);
    const meetingDate = checkMeetingDate(body.meetingDate, istToday());
    const settlementCode = clip(body.settlementCode, 60);
    const settlement = settlementCode ? await getSettlement(settlementCode) : null;
    if (!settlement) throw new HttpError(400, "Choose the community");
    const type = await findLookup(TYPE_LIST[kind], clip(body.typeKey, 80));
    if (!type) throw new HttpError(400, kind === "camp" ? "Choose the type of camp" : "Choose the type of meeting");

    // Camp form: who supported the camp.
    let camp: Partial<MeetingRecordDoc> = {};
    if (kind === "camp") {
      const stake = await findLookup("camp_stakeholder_type", clip(body.stakeholderType, 80));
      if (!stake) throw new HttpError(400, "Choose who supported the camp (Government, NGO …)");
      const stakeName = clip(body.stakeholderName, 200);
      if (stakeName.length < 2) throw new HttpError(400, "Write the name of the supporting organisation or person");
      camp = {
        stakeholderType: stake.key,
        stakeholderTypeLabel: stake.label,
        stakeholderName: stakeName,
        participantNotes: clip(body.participantNotes, 2000) || undefined,
      };
    }

    const now = new Date();
    const doc: MeetingRecordDoc = {
      kind,
      ...camp,
      meetingDate,
      settlementCode,
      communityName: settlement.label,
      typeKey: type.key,
      typeLabel: type.label,
      topic: cleanTopic(body.topic),
      attendanceLinks: parseLinks(body.attendanceLinks, "Attendance sheet"),
      totalParticipants: parseParticipants(body.totalParticipants),
      photoLinks: parseLinks(body.photoLinks, "Group photo"),
      remarks: clip(body.remarks, 4000) || undefined,
      ...(user.role === "cm" ? { cmId: user._id, cmName: user.name } : {}),
      source: "app",
      submittedAt: now,
      history: [{ at: now, by: user.name, note: user.role === "cm" ? "Filed" : `Entered by ${user.name}` }],
      createdAt: now,
      updatedAt: now,
    };
    const res = await (await meetingRecordsCol()).insertOne(doc);

    await notifyRoles(
      ["mis", "programme_manager", "director"],
      {
        category: kind === "camp" ? "camp_report" : "meeting_report",
        title: `${kind === "camp" ? "Camp" : "Meeting"} report · ${settlement.label}`,
        body:
          kind === "camp"
            ? `${user.name} filed a ${type.label} camp held on ${meetingDate} in ${settlement.label}, supported by ${doc.stakeholderTypeLabel} (${doc.stakeholderName}) — ${doc.totalParticipants} participants.`
            : `${user.name} filed a ${type.label} on ${meetingDate} in ${settlement.label} — ${doc.totalParticipants} participants.`,
        relatedType: kind === "camp" ? "camp_record" : "meeting_record",
        relatedId: String(res.insertedId),
        dedupeKey: `${kind}_report:${res.insertedId}`,
      },
      { excludeUserId: user._id }
    );
    await audit({
      actor: user,
      action: `${kind}_record.created`,
      entityType: "meeting_record",
      entityId: String(res.insertedId),
      ref: `${settlement.label} ${meetingDate}`,
      summary: `${kind === "camp" ? "Camp" : "Meeting"} report filed (${type.label})`,
    });
    return json({ record: publicMeetingRecord({ ...doc, _id: res.insertedId }) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
