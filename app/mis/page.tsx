import { PageTitle } from "@/components/ui";
import WeeklyDashboard from "@/components/WeeklyDashboard";
import ProgrammeDashboard from "@/components/ProgrammeDashboard";
import { weekOf, computeDashboard } from "@/lib/weekly/dashboard";
import { casesCol } from "@/lib/models";
import { segmentFilter } from "@/lib/cases/segments";

export const metadata = { title: "Dashboard · MIS" };

async function getDash() {
  try {
    const { weekStart, weekEnd, reportId } = weekOf(new Date());
    const dashboard = await computeDashboard(weekStart, weekEnd);
    // On this live page the two mother boxes count open cases — exactly what the
    // case pages they open list — instead of survey answers.
    const cases = await casesCol();
    const open = (s: "pregnant" | "newborn_mother") =>
      cases.countDocuments({ $and: [segmentFilter(s), { closed: false }] });
    dashboard.pregnantWomen = await open("pregnant");
    dashboard.mothersWithNewborn = await open("newborn_mother");
    // The week's Monday and Sunday as plain dates (weekOf labels them in UTC), so the
    // "households surveyed" box opens the survey list for exactly that week.
    const day = (x: Date) => x.toISOString().slice(0, 10);
    return { reportId, dashboard, range: { from: day(weekStart), to: day(weekEnd) } };
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
        <ProgrammeDashboard basePath="/mis" />
      </div>
      <h2 className="mb-3 text-base font-bold text-zinc-800 dark:text-zinc-100">
        Weekly command dashboard
      </h2>
      {d ? (
        <WeeklyDashboard dashboard={d.dashboard} basePath="/mis" range={d.range} />
      ) : (
        <p className="text-sm text-amber-600">Could not load the dashboard.</p>
      )}
    </div>
  );
}
