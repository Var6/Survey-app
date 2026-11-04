import { json, handleError, requireRoles, readJson, HttpError } from "@/lib/api";
import { visitRecordsCol, ensureIndexes, type VisitRecordDoc } from "@/lib/models";
import { publicVisitRecord } from "@/lib/serialize";
import { getSettlement } from "@/lib/settlements";
import { notifyRoles } from "@/lib/notifications";
import { audit } from "@/lib/audit";
import { clip } from "@/lib/schedule";
import { istToday } from "@/lib/time";
import { parseLinks } from "@/lib/meeting-records";
import {
  buildVisitFilter,
  checkVisitDate,
  cleanContact,
  cleanDiscussion,
  parseVisitedType,
  requireContacts,
  visitedTypeLabel,
} from "@/lib/visit-records";

export const runtime = "nodejs";

/** Visit reports (the "Visited" Google Form). Office roles see all; a CM sees only their own. */
export async function GET(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const p = new URL(req.url).searchParams;
    const filter = buildVisitFilter(user, p);
    const page = Math.max(Number(p.get("page")) || 1, 1);
    const pageSize = Math.min(Math.max(Number(p.get("pageSize")) || 100, 1), 200);

    const col = await visitRecordsCol();
    const [docs, total, byType, noPhoto] = await Promise.all([
      col
        .find(filter)
        .sort({ visitDate: -1, submittedAt: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      col.countDocuments(filter),
      // Summary of the WHOLE filtered set, not just this page.
      col
        .aggregate<{ _id: string; n: number }>([
          { $match: filter },
          { $group: { _id: "$visitedType", n: { $sum: 1 } } },
          { $sort: { n: -1 } },
        ])
        .toArray(),
      col.countDocuments({ $and: [filter, { photoLinks: { $size: 0 } }] }),
    ]);
    return json({
      records: docs.map(publicVisitRecord),
      total,
      page,
      pageSize,
      pages: Math.max(Math.ceil(total / pageSize), 1),
      summary: {
        visits: total,
        missingPhoto: noPhoto,
        byType: byType.map((t) => ({ key: t._id, label: visitedTypeLabel(t._id), visits: t.n })),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

/** A CM files a visit report. (Office roles may also enter one on a CM's behalf.) */
export async function POST(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    await ensureIndexes();
    const body = await readJson<Record<string, unknown>>(req);

    const visitDate = checkVisitDate(body.visitDate, istToday());
    const settlementCode = clip(body.settlementCode, 60);
    const settlement = settlementCode ? await getSettlement(settlementCode) : null;
    if (!settlement) throw new HttpError(400, "Choose the tola / community");
    const visitedType = parseVisitedType(body.visitedType);
    const contacts = cleanContact(body, visitedType);
    requireContacts(visitedType, contacts);

    const now = new Date();
    const doc: VisitRecordDoc = {
      visitDate,
      settlementCode,
      communityName: settlement.label,
      visitedType,
      stakeholderNames: clip(body.stakeholderNames, 400) || undefined,
      discussion: cleanDiscussion(body.discussion),
      photoLinks: parseLinks(body.photoLinks, "Photo"),
      remarks: clip(body.remarks, 4000) || undefined,
      ...contacts,
      ...(user.role === "cm" ? { cmId: user._id, cmName: user.name } : {}),
      source: "app",
      submittedAt: now,
      history: [{ at: now, by: user.name, note: user.role === "cm" ? "Filed" : `Entered by ${user.name}` }],
      createdAt: now,
      updatedAt: now,
    };
    const res = await (await visitRecordsCol()).insertOne(doc);

    await notifyRoles(
      ["mis", "programme_manager", "director"],
      {
        category: "visit_report",
        title: `Visit report · ${settlement.label}`,
        body: `${user.name} visited a ${visitedTypeLabel(visitedType).toLowerCase()} in ${settlement.label} on ${visitDate}.`,
        relatedType: "visit_record",
        relatedId: String(res.insertedId),
        dedupeKey: `visit_report:${res.insertedId}`,
      },
      { excludeUserId: user._id }
    );
    await audit({
      actor: user,
      action: "visit_record.created",
      entityType: "visit_record",
      entityId: String(res.insertedId),
      ref: `${settlement.label} ${visitDate}`,
      summary: `Visit report filed (${visitedTypeLabel(visitedType)})`,
    });
    return json({ record: publicVisitRecord({ ...doc, _id: res.insertedId }) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
