import { Suspense } from "react";
import { PageTitle } from "@/components/ui";
import FinanceClient from "@/components/FinanceClient";

export const metadata = { title: "Finance · Director" };

export default function FinancePage() {
  return (
    <div>
      <PageTitle
        title="Finance"
        subtitle="Expenses, reimbursements, statement and export"
        back={{ href: "/director", label: "Overview" }}
      />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <FinanceClient />
      </Suspense>
    </div>
  );
}
