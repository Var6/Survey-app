import Link from "next/link";
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
        action={
          <Link
            href="/cm/monthly-print"
            className="rounded-lg border border-teal-600 bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            ⬇ PDF
          </Link>
        }
      />
      <MonthlyReportForm variantKey="cm" />
    </div>
  );
}
