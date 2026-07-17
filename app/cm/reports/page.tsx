import { PageTitle } from "@/components/ui";
import ReportsClient from "@/components/ReportsClient";

export const metadata = { title: "Reports" };

export default function CmReportsPage() {
  return (
    <div>
      <PageTitle
        title="My reports"
        subtitle="Submit daily, weekly and monthly activity"
      />
      <ReportsClient scope="cm" />
    </div>
  );
}
