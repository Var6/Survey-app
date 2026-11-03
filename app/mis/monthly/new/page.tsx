import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import MonthlyReportForm from "@/components/MonthlyReportForm";
import { MONTHLY_VARIANTS } from "@/lib/monthly/variants";
import { suggestOpenMonth } from "@/lib/monthly/load";

export const metadata = { title: "New monthly report · MIS" };

export default async function MisNewMonthlyPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  // ?month=YYYY-MM reopens a chosen month; otherwise the first month still open.
  const { month } = await searchParams;
  const initialMonth =
    typeof month === "string" && /^\d{4}-\d{2}$/.test(month)
      ? month
      : await suggestOpenMonth(user._id!);

  return (
    <div>
      <PageTitle
        title="New monthly report"
        subtitle={MONTHLY_VARIANTS.mis.subtitle}
        back={{ href: "/mis/monthly", label: "My reports" }}
      />
      <MonthlyReportForm variantKey="mis" basePath="/mis/monthly" initialMonth={initialMonth} />
    </div>
  );
}
