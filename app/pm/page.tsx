import Link from "next/link";
import { PageTitle, btnPrimary } from "@/components/ui";
import WeeklyDashboard from "@/components/WeeklyDashboard";
import ProgrammeDashboard from "@/components/ProgrammeDashboard";
import { weekOf, computeDashboard } from "@/lib/weekly/dashboard";

export const metadata = { title: "Dashboard · Programme Manager" };

async function getDash() {
  try {
    const { weekStart, weekEnd, reportId } = weekOf(new Date());
    const dashboard = await computeDashboard(weekStart, weekEnd);
    return { reportId, dashboard };
  } catch {
    return null;
  }
}

export default async function PmHome() {
  const d = await getDash();
  return (
    <div>
      <PageTitle
        title="Programme Manager dashboard"
        subtitle={d ? `Current week · ${d.reportId}` : undefined}
        action={
          <Link href="/pm/weekly" className={btnPrimary}>
            Weekly report
          </Link>
        }
      />

      {/* Live programme metrics (auto-refreshing charts) */}
      <div className="mb-6">
        <ProgrammeDashboard />
      </div>

      <h2 className="mb-3 text-base font-bold text-zinc-800 dark:text-zinc-100">
        Weekly command dashboard
      </h2>
      {d ? (
        <WeeklyDashboard dashboard={d.dashboard} />
      ) : (
        <p className="text-sm text-amber-600">Could not load the dashboard (check the database).</p>
      )}
    </div>
  );
}
