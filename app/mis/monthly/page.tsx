import { PageTitle } from "@/components/ui";
import MyMonthlyReportsClient from "@/components/MyMonthlyReportsClient";

export const metadata = { title: "My monthly reports · MIS" };

export default function MisMonthlyPage() {
  return (
    <div>
      <PageTitle
        title="My monthly reports"
        subtitle="Every month's report in one place — start a new one or open a submitted one"
        back={{ href: "/mis", label: "Dashboard" }}
      />
      <MyMonthlyReportsClient basePath="/mis/monthly" variantKey="mis" />
    </div>
  );
}
