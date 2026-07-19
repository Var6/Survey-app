import { PageTitle } from "@/components/ui";
import WeeklyDashboard from "@/components/WeeklyDashboard";
import ProgrammeDashboard from "@/components/ProgrammeDashboard";
import { weekOf, computeDashboard } from "@/lib/weekly/dashboard";

export const metadata = { title: "Dashboard · MIS" };

async function getDash() {
  try {
    const { weekStart, weekEnd, reportId } = weekOf(new Date());
    const dashboard = await computeDashboard(weekStart, weekEnd);
    return { reportId, dashboard };
  } catch {
    return null;
  }
}

export default async function MisHome() {
  const d = await getDash();
  return (
    <div>
      <PageTitle
        title="MIS dashboard"
        subtitle={d ? `Current week · ${d.reportId}` : undefined}
      />
      <div className="mb-6">
        <ProgrammeDashboard />
      </div>
      {d ? (
        <WeeklyDashboard dashboard={d.dashboard} />
      ) : (
        <p className="text-sm text-amber-600">Could not load the dashboard.</p>
      )}
    </div>
  );
}
