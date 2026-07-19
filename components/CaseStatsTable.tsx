import { Card } from "@/components/ui";

interface Row {
  module: string;
  title: string;
  newCases: number;
  completed: number;
  open: number;
  overdue: number;
}

export default function CaseStatsTable({ rows }: { rows: Row[] }) {
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="py-1.5 font-medium">Module</th>
              <th className="py-1.5 text-right font-medium">New</th>
              <th className="py-1.5 text-right font-medium">Completed</th>
              <th className="py-1.5 text-right font-medium">Open</th>
              <th className="py-1.5 text-right font-medium">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.module} className="border-t border-zinc-100 dark:border-zinc-900">
                <td className="py-1.5 text-zinc-700 dark:text-zinc-300">{r.title}</td>
                <td className="py-1.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                  {r.newCases}
                </td>
                <td className="py-1.5 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                  {r.completed}
                </td>
                <td className="py-1.5 text-right tabular-nums text-zinc-900 dark:text-zinc-100">
                  {r.open}
                </td>
                <td
                  className={`py-1.5 text-right tabular-nums ${
                    r.overdue > 0 ? "font-semibold text-red-600 dark:text-red-400" : "text-zinc-400"
                  }`}
                >
                  {r.overdue}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
