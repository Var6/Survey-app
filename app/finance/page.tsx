import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { PageTitle, Card } from "@/components/ui";
import { ProgressRing, StatTile } from "@/components/charts";
import { computeFinanceMetrics } from "@/lib/finance/requests";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Finance dashboard" };
export const dynamic = "force-dynamic";

export default async function FinanceHome() {
  const user = await currentUser();
  if (!user) redirect("/login");
  const m = await computeFinanceMetrics(user);
  const money = (n: number) => formatMoney(n, m.currency);

  return (
    <div className="space-y-6">
      <PageTitle
        title="Finance dashboard"
        subtitle="Requests to approve and pay, project funds and this month's spending"
      />

      {m.oldestPendingDays !== null && m.oldestPendingDays >= 3 && (
        <Link
          href="/finance/requisitions?status=pending"
          className="block rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300"
        >
          The oldest request has been waiting {m.oldestPendingDays} days for a decision. Open it →
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex items-center gap-5">
            <ProgressRing value={m.funds.spent} max={m.funds.total}>
              <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{m.funds.percentSpent}%</span>
              <span className="text-[11px] text-zinc-400">spent</span>
            </ProgressRing>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Funds left</p>
              <p className="mt-0.5 text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{money(m.funds.balance)}</p>
              <p className="text-xs text-zinc-400">
                {money(m.funds.spent)} of {money(m.funds.total)} used
              </p>
            </div>
          </div>
          {m.projects.length > 1 && (
            <ul className="mt-4 space-y-1 border-t border-zinc-100 pt-3 text-sm dark:border-zinc-800">
              {m.projects.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="truncate text-zinc-600 dark:text-zinc-300">{p.name}</span>
                  <span className="tabular-nums text-zinc-500">{money(p.balance)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/finance/accounts" className="mt-3 inline-block text-[11px] font-medium text-teal-600 dark:text-teal-400">
            Funds, expenses & statement →
          </Link>
        </Card>

        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          {m.tiles.slice(0, 4).map((t) => (
            <StatTile
              key={t.key}
              label={t.label}
              value={t.value}
              tone={t.tone}
              hint={`${money(t.amount ?? 0)}${t.hint ? ` · ${t.hint}` : ""}`}
              href={t.href}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {m.tiles.slice(4).map((t) => (
          <StatTile
            key={t.key}
            label={t.label}
            value={t.value}
            tone={t.tone}
            hint={money(t.amount ?? 0)}
            href={t.href}
          />
        ))}
        <StatTile
          label={`Expenses in ${m.month.label}`}
          value={m.month.expenses.count}
          hint={money(m.month.expenses.amount)}
          href="/finance/accounts?tab=expenses"
        />
        <StatTile
          label={`Salaries & benefits paid in ${m.month.label}`}
          value={m.month.salaryPaid.count}
          hint={money(m.month.salaryPaid.amount)}
          href="/finance/accounts?tab=payroll"
        />
      </div>
    </div>
  );
}
