import { casesCol } from "@/lib/models";
import { computeDashboard } from "@/lib/weekly/dashboard";
import { MODULE_LIST } from "@/lib/cases/modules";

/** Calendar-month bucket for a given date, plus the PMM-YYYY-MM report id. */
export function monthOf(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const monthStart = new Date(Date.UTC(y, m, 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999));
  const reportId = `PMM-${y}-${String(m + 1).padStart(2, "0")}`;
  return { monthStart, monthEnd, year: y, month: m + 1, reportId };
}

/** Per-module case activity for PMM Section G (Action cases & service follow-up). */
async function caseModuleStats(monthStart: Date, monthEnd: Date) {
  const col = await casesCol();
  const today = new Date().toISOString().slice(0, 10);
  const agg = await col
    .aggregate([
      {
        $group: {
          _id: "$module",
          newCases: {
            $sum: {
              $cond: [
                { $and: [{ $gte: ["$createdAt", monthStart] }, { $lte: ["$createdAt", monthEnd] }] },
                1,
                0,
              ],
            },
          },
          completed: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$closed", true] },
                    { $gte: ["$closedAt", monthStart] },
                    { $lte: ["$closedAt", monthEnd] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          open: { $sum: { $cond: ["$closed", 0, 1] } },
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
        },
      },
    ])
    .toArray();
  const byKey = new Map(agg.map((a) => [a._id as string, a]));
  return MODULE_LIST.map((m) => {
    const a = byKey.get(m.key);
    return {
      module: m.key,
      title: m.title,
      newCases: (a?.newCases as number) || 0,
      completed: (a?.completed as number) || 0,
      open: (a?.open as number) || 0,
      overdue: (a?.overdue as number) || 0,
    };
  });
}

export async function computeMonthlyDashboard(monthStart: Date, monthEnd: Date) {
  const base = await computeDashboard(monthStart, monthEnd);
  const caseStats = await caseModuleStats(monthStart, monthEnd);
  return { ...base, caseStats };
}
