import { PageTitle } from "@/components/ui";
import MyMonthlyReportsClient from "@/components/MyMonthlyReportsClient";

export const metadata = { title: "My monthly reports · Programme Manager" };

export default function PmMonthlyPage() {
  return (
    <div>
      <PageTitle
        title="My monthly reports"
        subtitle="Every month's report in one place — start a new one or open a submitted one"
        back={{ href: "/pm", label: "Dashboard" }}
      />
      <MyMonthlyReportsClient basePath="/pm/monthly" variantKey="pm" />
    </div>
  );
}
