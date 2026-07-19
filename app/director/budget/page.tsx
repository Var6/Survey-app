import { PageTitle } from "@/components/ui";
import BudgetsClient from "@/components/BudgetsClient";

export const metadata = { title: "Budget · Director" };

export default function DirectorBudgetPage() {
  return (
    <div>
      <PageTitle
        title="Programme budget"
        subtitle="Funder-format budget with auto inflation, category summary & Excel export"
        back={{ href: "/director" }}
      />
      <BudgetsClient />
    </div>
  );
}
