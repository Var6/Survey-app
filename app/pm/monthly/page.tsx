import Link from "next/link";
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
        action={
          <Link
            href="/pm/monthly-print"
            className="rounded-lg border border-teal-600 bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            ⬇ PDF
          </Link>
        }
      />
      <MonthlyReportForm />
    </div>
  );
}
