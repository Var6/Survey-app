import { json, handleError, requireRoles } from "@/lib/api";
import { supportRecordsCol } from "@/lib/models";
import { buildSupportFilter } from "@/lib/support/query";

export const runtime = "nodejs";

const GROUPS: Record<string, { label: string; key: string | object; unwind?: string }> = {
  community: { label: "Community", key: "$communityName" },
  referral: { label: "Referral", key: "$referralLabel" },
  type: { label: "Type of support", key: "$supportTypeLabels", unwind: "$supportTypeLabels" },
  month: { label: "Month", key: { $substrBytes: ["$supportDate", 0, 7] } },
  cm: { label: "Community Mobiliser", key: { $ifNull: ["$cmName", "Not recorded"] } },
};

/**
 * Support report: counts by community / referral / type of support / month / CM,
 * split into complete and follow-up required, with how many are verified.
 * Same filters as the list, so the report always matches what is on screen.
 */
export async function GET(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const p = new URL(req.url).searchParams;
    const g = GROUPS[p.get("group") || "community"] ?? GROUPS.community;
    const filter = buildSupportFilter(user, p);
    const col = await supportRecordsCol();
    const rows = await col
      .aggregate<{ _id: string; total: number; complete: number; followUp: number; verified: number; pending: number; linked: number }>([
        { $match: filter },
        ...(g.unwind ? [{ $unwind: g.unwind }] : []),
        {
          $group: {
            _id: g.key,
            total: { $sum: 1 },
            complete: { $sum: { $cond: [{ $eq: ["$status", "complete"] }, 1, 0] } },
            followUp: { $sum: { $cond: [{ $eq: ["$status", "follow_up_required"] }, 1, 0] } },
            verified: { $sum: { $cond: [{ $eq: ["$verification", "verified"] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ["$verification", "pending"] }, 1, 0] } },
            linked: { $sum: { $cond: [{ $eq: ["$linkStatus", "linked"] }, 1, 0] } },
          },
        },
        { $sort: p.get("group") === "month" ? { _id: -1 } : { total: -1, _id: 1 } },
      ])
      .toArray();
    const sum = (k: "total" | "complete" | "followUp" | "verified" | "pending" | "linked") => rows.reduce((a, r) => a + r[k], 0);
    return json({
      group: p.get("group") || "community",
      groupLabel: g.label,
      rows: rows.map((r) => ({ label: String(r._id), total: r.total, complete: r.complete, followUp: r.followUp, verified: r.verified, pending: r.pending, linked: r.linked })),
      totals: { total: sum("total"), complete: sum("complete"), followUp: sum("followUp"), verified: sum("verified"), pending: sum("pending"), linked: sum("linked") },
      // a record with several support types appears under each, so "type" totals can exceed the record count
      note: g.unwind ? "A record with more than one type of support is counted under each type." : null,
    });
  } catch (e) {
    return handleError(e);
  }
}
