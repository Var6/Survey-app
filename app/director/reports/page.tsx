import { PageTitle } from "@/components/ui";
import ReportsClient from "@/components/ReportsClient";

export const metadata = { title: "Reports · Director" };

export default function DirectorReportsPage() {
  return (
    <div>
      <PageTitle
        title="Reports"
        subtitle="Daily / weekly / monthly CM activity"
        back={{ href: "/director", label: "Overview" }}
      />
      <ReportsClient scope="director" />
    </div>
  );
}
