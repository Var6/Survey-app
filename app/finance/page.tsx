import { PageTitle } from "@/components/ui";
import FinanceClient from "@/components/FinanceClient";

export const metadata = { title: "Finance" };

export default function FinanceHome() {
  return (
    <div>
      <PageTitle
        title="Finance"
        subtitle="Funds, expenses, payroll, reimbursements, statement & export"
      />
      <FinanceClient />
    </div>
  );
}
