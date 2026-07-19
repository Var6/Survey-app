import { PageTitle } from "@/components/ui";
import FinanceClient from "@/components/FinanceClient";
import ProgrammeDashboard from "@/components/ProgrammeDashboard";

export const metadata = { title: "Finance" };

export default function FinanceHome() {
  return (
    <div>
      <PageTitle
        title="Finance"
        subtitle="Funds, expenses, payroll, reimbursements, statement & export"
      />
      <div className="mb-6">
        <ProgrammeDashboard />
      </div>
      <FinanceClient />
    </div>
  );
}
