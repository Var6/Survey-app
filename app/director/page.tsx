import Link from "next/link";
import ProgrammeDashboard from "@/components/ProgrammeDashboard";
import {
  surveysCol,
  usersCol,
  projectsCol,
  requisitionsCol,
} from "@/lib/models";

export const metadata = { title: "Overview · Director" };

async function getStats() {
  try {
    const surveys = await surveysCol();
    const users = await usersCol();
    const projects = await projectsCol();
    const reqs = await requisitionsCol();
    const [total, unsynced, cms, projectCount, pendingReq] = await Promise.all([
      surveys.countDocuments({}),
      surveys.countDocuments({ "sync.status": { $ne: "synced" } }),
      users.countDocuments({ role: "cm" }),
      projects.countDocuments({}),
      reqs.countDocuments({ status: "pending" }),
    ]);
    return { total, unsynced, cms, projectCount, pendingReq };
  } catch {
    return null;
  }
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}

const MODULES: [string, string, string][] = [
  ["/director/projects", "Projects & funds", "Create funding projects and track balances"],
  ["/director/users", "Users", "Manage directors, accountants and mobilisers"],
  ["/director/surveys", "Surveys", "View all household surveys, filter, export to Excel"],
  ["/director/sync", "Frappe sync", "Monitor sync status and re-sync failed records"],
  ["/director/finance", "Finance", "Expenses, reimbursements, statement & Excel export"],
  ["/director/reports", "Reports", "Daily / weekly / monthly CM activity"],
  ["/director/weekly", "Weekly reports", "Review & approve Programme Manager weekly reports"],
];

export default async function DirectorHome() {
  const stats = await getStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          Overview
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Programme-wide view across all mobilisers and settlements.
        </p>
      </div>

      <ProgrammeDashboard />

      {stats ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Surveys collected" value={stats.total} />
          <Stat label="Pending Frappe sync" value={stats.unsynced} />
          <Stat label="Mobilisers" value={stats.cms} />
          <Stat label="Projects" value={stats.projectCount} />
          <Stat label="Requisitions to review" value={stats.pendingReq} />
        </div>
      ) : (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-300">
          Could not read the database. Set <code>MONGODB_URI</code> in{" "}
          <code>.env.local</code> and restart.
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Modules
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULES.map(([href, title, desc]) => (
            <Link
              key={href}
              href={href}
              className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-teal-500 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-teal-600"
            >
              <p className="font-medium text-zinc-900 dark:text-zinc-50">{title}</p>
              <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
                {desc}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
