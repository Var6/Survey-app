import { PageTitle } from "@/components/ui";
import WeeklyReportForm from "@/components/WeeklyReportForm";

export const metadata = { title: "Weekly report · Programme Manager" };

export default function PmWeeklyPage() {
  return (
    <div>
      <PageTitle
        title="Weekly report"
        subtitle="Review the auto dashboard, then complete your accountability sections"
        back={{ href: "/pm", label: "Dashboard" }}
      />
      <WeeklyReportForm />
    </div>
  );
}
