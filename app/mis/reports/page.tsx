import { PageTitle } from "@/components/ui";
import ReportingHub from "@/components/ReportingHub";

export const metadata = { title: "Reports · MIS" };

export default function MisReportsPage() {
  return (
    <div>
      <PageTitle
        title="Reports"
        subtitle="All daily, weekly and monthly reports — choose a role, then a report type"
        back={{ href: "/mis", label: "Dashboard" }}
      />
      {/* MIS reads and exports everything, but approval stays with the
          Director (PM reports) and the Programme Manager (CM/MIS reports). */}
      <ReportingHub canReview={false} printBase="/mis" />
    </div>
  );
}
