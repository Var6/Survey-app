import { PageTitle } from "@/components/ui";
import MonthlyReportForm from "@/components/MonthlyReportForm";
import { MONTHLY_VARIANTS } from "@/lib/monthly/variants";

export const metadata = { title: "मासिक रिपोर्ट · Monthly report" };

export default function CmMonthlyPage() {
  const v = MONTHLY_VARIANTS.cm;
  return (
    <div>
      <PageTitle
        title={v.title}
        subtitle={v.subtitle}
        back={{ href: "/cm", label: "Home" }}
      />
      <MonthlyReportForm variantKey="cm" />
    </div>
  );
}
