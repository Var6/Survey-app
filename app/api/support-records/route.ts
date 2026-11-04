import { json, handleError, requireRoles, readJson } from "@/lib/api";
import { supportRecordsCol } from "@/lib/models";
import { publicSupportRecord } from "@/lib/serialize";
import { buildSupportFilter } from "@/lib/support/query";
import { createSupportRecord, type SupportInput } from "@/lib/support/service";

export const runtime = "nodejs";

/**
 * Support & follow-up records. Office roles see all; a CM sees only the ones
 * they filed (or, for older imported ones, those of their own community).
 * Paged on the server, 100 a page; the summary covers the whole filtered set.
 */
export async function GET(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const p = new URL(req.url).searchParams;
    const filter = buildSupportFilter(user, p);
    const page = Math.max(Number(p.get("page")) || 1, 1);
    const pageSize = Math.min(Math.max(Number(p.get("pageSize")) || 100, 1), 200);
    const col = await supportRecordsCol();

    const group = (field: string) =>
      col
        .aggregate<{ _id: string; n: number; label: string }>([
          { $match: filter },
          { $group: { _id: `$${field}`, n: { $sum: 1 }, label: { $first: `$${field === "referral" ? "referralLabel" : field}` } } },
          { $sort: { n: -1 } },
        ])
        .toArray();

    const [docs, total, byStatus, byReferral, byLink, byVerification] = await Promise.all([
      col.find(filter).sort({ supportDate: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray(),
      col.countDocuments(filter),
      group("status"),
      group("referral"),
      group("linkStatus"),
      group("verification"),
    ]);
    const n = (rows: { _id: string; n: number }[], k: string) => rows.find((r) => r._id === k)?.n ?? 0;
    return json({
      records: docs.map(publicSupportRecord),
      total,
      page,
      pageSize,
      pages: Math.max(Math.ceil(total / pageSize), 1),
      summary: {
        total,
        complete: n(byStatus, "complete"),
        followUp: n(byStatus, "follow_up_required"),
        linked: n(byLink, "linked"),
        suggested: n(byLink, "suggested"),
        unlinked: n(byLink, "unlinked"),
        pendingVerification: n(byVerification, "pending"),
        byReferral: byReferral.map((r) => ({ key: r._id, label: r.label, count: r.n })),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

/** File the support form. Linked to a case, "Complete" asks for that case to be closed. */
export async function POST(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const body = await readJson<SupportInput>(req);
    const rec = await createSupportRecord(user, body);
    return json({ record: publicSupportRecord(rec) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
