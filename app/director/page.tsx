import ProgrammeDashboard from "@/components/ProgrammeDashboard";
import { PageHeaderBroadcast } from "@/components/PageHeader";
import { StatTile } from "@/components/charts";
import {
  surveysCol,
  usersCol,
  projectsCol,
  requisitionsCol,
} from "@/lib/models";

export const metadata = { title: "Overview · Director" };

async function getOps() {
  try {
    const surveys = await surveysCol();
    const users = await usersCol();
    const projects = await projectsCol();
    const reqs = await requisitionsCol();
    const [unsynced, cms, projectCount, pendingReq] = await Promise.all([
      surveys.countDocuments({ "sync.status": { $ne: "synced" } }),
      users.countDocuments({ role: "cm" }),
      projects.countDocuments({}),
      reqs.countDocuments({ status: "pending" }),
    ]);
    return { unsynced, cms, projectCount, pendingReq };
  } catch {
    return null;
  }
}

export default async function DirectorHome() {
  const ops = await getOps();

  return (
    <div className="space-y-6">
      <PageHeaderBroadcast
        title="Overview"
        subtitle="Programme-wide, real-time view across all mobilisers and settlements"
      />
      <div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Overview</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Programme-wide, real-time view across all mobilisers and settlements.
        </p>
      </div>

      <ProgrammeDashboard />

      {ops && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">Operations</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Mobilisers" value={ops.cms} />
            <StatTile label="Projects" value={ops.projectCount} />
            <StatTile
              label="Pending Frappe sync"
              value={ops.unsynced}
              tone={ops.unsynced > 0 ? "warn" : "good"}
            />
            <StatTile
              label="Requisitions to review"
              value={ops.pendingReq}
              tone={ops.pendingReq > 0 ? "warn" : "normal"}
            />
          </div>
        </div>
      )}
    </div>
  );
}
