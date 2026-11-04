import { json, handleError, requireRoles } from "@/lib/api";
import { casesCol } from "@/lib/models";
import { MODULE_LIST } from "@/lib/cases/modules";
import { SEGMENTS, segmentFilter } from "@/lib/cases/segments";
import { istToday } from "@/lib/time";

export const runtime = "nodejs";

/** Case-module cards. Same definitions as the lists they open (open = not closed). */
export async function GET() {
  try {
    await requireRoles("director", "mis", "programme_manager");
    const col = await casesCol();
    const today = istToday();

    const agg = await col
      .aggregate([
        {
          $group: {
            _id: "$module",
            total: { $sum: 1 },
            open: { $sum: { $cond: ["$closed", 0, 1] } },
            urgent: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ["$closed", false] }, { $eq: ["$priority", "urgent"] }] },
                  1,
                  0,
                ],
              },
            },
            overdue: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$closed", false] },
                      { $gt: ["$dueDate", ""] },
                      { $lt: ["$dueDate", today] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
            pendingReview: {
              $sum: {
                $cond: [{ $in: ["$workflowStatus", ["closure_requested", "under_review"]] }, 1, 0],
              },
            },
          },
        },
      ])
      .toArray();

    const byKey = new Map(agg.map((a) => [a._id as string, a]));
    const summary = MODULE_LIST.map((m) => {
      const a = byKey.get(m.key);
      return {
        module: m.key,
        title: m.title,
        short: m.short,
        icon: m.icon,
        color: m.color,
        total: (a?.total as number) || 0,
        open: (a?.open as number) || 0,
        urgent: (a?.urgent as number) || 0,
        overdue: (a?.overdue as number) || 0,
        pendingReview: (a?.pendingReview as number) || 0,
      };
    });
    const totals = summary.reduce(
      (t, s) => ({
        open: t.open + s.open,
        urgent: t.urgent + s.urgent,
        overdue: t.overdue + s.overdue,
        pendingReview: t.pendingReview + s.pendingReview,
      }),
      { open: 0, urgent: 0, overdue: 0, pendingReview: 0 }
    );

    const segments = await Promise.all(
      SEGMENTS.map(async (s) => ({
        key: s.key,
        module: s.module,
        label: s.label,
        open: await col.countDocuments({ $and: [segmentFilter(s.key), { closed: false }] }),
      }))
    );
    return json({ summary, totals, segments, at: new Date().toISOString() });
  } catch (e) {
    return handleError(e);
  }
}
