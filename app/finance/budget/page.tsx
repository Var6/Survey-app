import { PageTitle } from "@/components/ui";
import BudgetsClient from "@/components/BudgetsClient";

export const metadata = { title: "Budget · Finance" };

export default function FinanceBudgetPage() {
  return (
    <div>
      <PageTitle
        title="Programme budget"
        subtitle="Funder-format budget with auto inflation, category summary & Excel export"
        back={{ href: "/finance" }}
      />
      <BudgetsClient />
    </div>
  );
}
