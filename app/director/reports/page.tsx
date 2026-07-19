import { PageTitle } from "@/components/ui";
import ReportingHub from "@/components/ReportingHub";

export const metadata = { title: "Reports · Director" };

export default function DirectorReportsPage() {
  return (
    <div>
      <PageTitle
        title="Reports"
        subtitle="Choose a role, then a report type — daily reports open in a calendar"
        back={{ href: "/director", label: "Overview" }}
      />
      <ReportingHub />
    </div>
  );
}
