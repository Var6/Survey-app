import { PageTitle } from "@/components/ui";
import PmDailyClient from "@/components/PmDailyClient";

export const metadata = { title: "Daily update · Programme Manager" };

export default function PmDailyPage() {
  return (
    <div>
      <PageTitle
        title="Daily update"
        subtitle="Four quick fields — where you worked, what got done, risks, tomorrow's plan"
        back={{ href: "/pm" }}
      />
      <PmDailyClient />
    </div>
  );
}
