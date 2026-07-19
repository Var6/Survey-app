import { json, handleError, requireRoles } from "@/lib/api";
import { casesCol } from "@/lib/models";
import { MODULE_LIST } from "@/lib/cases/modules";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireRoles("director", "mis", "programme_manager");
    const col = await casesCol();
    const today = new Date().toISOString().slice(0, 10);

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
      };
    });
    const totals = summary.reduce(
      (t, s) => ({
        open: t.open + s.open,
        urgent: t.urgent + s.urgent,
        overdue: t.overdue + s.overdue,
      }),
      { open: 0, urgent: 0, overdue: 0 }
    );
    return json({ summary, totals, at: new Date().toISOString() });
  } catch (e) {
    return handleError(e);
  }
}
