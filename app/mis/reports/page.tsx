import { PageTitle } from "@/components/ui";
import ReportsClient from "@/components/ReportsClient";

export const metadata = { title: "CM Reports · MIS" };

export default function MisReportsPage() {
  return (
    <div>
      <PageTitle title="CM daily reports" subtitle="All mobiliser field reports" />
      <ReportsClient scope="director" />
    </div>
  );
}
