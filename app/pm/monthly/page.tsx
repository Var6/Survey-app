import { PageTitle } from "@/components/ui";
import MonthlyReportForm from "@/components/MonthlyReportForm";

export const metadata = { title: "Monthly report · Programme Manager" };

export default function PmMonthlyPage() {
  return (
    <div>
      <PageTitle
        title="Monthly report"
        subtitle="Auto monthly dashboard, then your accountability sections"
        back={{ href: "/pm", label: "Dashboard" }}
      />
      <MonthlyReportForm />
    </div>
  );
}
