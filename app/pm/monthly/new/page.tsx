import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import MonthlyReportForm from "@/components/MonthlyReportForm";
import { MONTHLY_VARIANTS } from "@/lib/monthly/variants";
import { suggestOpenMonth } from "@/lib/monthly/load";
import { isMonthKey } from "@/lib/monthly/month";

export const metadata = { title: "New monthly report · Programme Manager" };

export default async function PmNewMonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  // ?month=YYYY-MM reopens a chosen month; otherwise the first month still open.
  const { month } = await searchParams;
  const initialMonth =
    isMonthKey(month)
      ? month
      : await suggestOpenMonth(user._id!);

  return (
    <div>
      <PageTitle
        title="New monthly report"
        subtitle={MONTHLY_VARIANTS.pm.subtitle}
        back={{ href: "/pm/monthly", label: "My reports" }}
      />
      <MonthlyReportForm variantKey="pm" basePath="/pm/monthly" initialMonth={initialMonth} />
    </div>
  );
}
