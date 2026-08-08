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
      />
      <MonthlyReportForm variantKey="mis" />
    </div>
  );
}
