import Link from "next/link";
import { PageTitle, btnPrimary } from "@/components/ui";
import ProgrammeDashboard from "@/components/ProgrammeDashboard";
import { weekOf } from "@/lib/weekly/dashboard";

export const metadata = { title: "Dashboard · Programme Manager" };

export default function PmHome() {
  const { reportId } = weekOf(new Date());
  return (
    <div>
      <PageTitle
        title="Programme Manager dashboard"
        subtitle={`Current week · ${reportId}`}
        action={
          <Link href="/pm/survey/new" className={btnPrimary}>
            + New survey
          </Link>
        }
      />
      {/* Live programme metrics (auto-refreshing charts). The weekly command
          dashboard lives inside the weekly report itself. */}
      <ProgrammeDashboard />
    </div>
  );
}
