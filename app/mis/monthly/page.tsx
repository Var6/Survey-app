import Link from "next/link";
import { PageTitle } from "@/components/ui";
import MonthlyReportForm from "@/components/MonthlyReportForm";
import { MONTHLY_VARIANTS } from "@/lib/monthly/variants";

export const metadata = { title: "Monthly report · MIS" };

export default function MisMonthlyPage() {
  const v = MONTHLY_VARIANTS.mis;
  return (
    <div>
      <PageTitle
        title={v.title}
        subtitle={v.subtitle}
        back={{ href: "/mis", label: "Dashboard" }}
        action={
          <Link
            href="/mis/monthly-print"
            className="rounded-lg border border-teal-600 bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            ⬇ PDF
          </Link>
        }
      />
      <MonthlyReportForm variantKey="mis" />
    </div>
  );
}
