import { Suspense } from "react";
import { PageTitle } from "@/components/ui";
import FinanceClient from "@/components/FinanceClient";

export const metadata = { title: "Funds & expenses · Finance" };

export default function FinanceAccountsPage() {
  return (
    <div>
      <PageTitle
        title="Funds, expenses & payroll"
        subtitle="Project funds, expenses, salaries, statement and export"
        back={{ href: "/finance", label: "Dashboard" }}
      />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <FinanceClient showRequests={false} />
      </Suspense>
    </div>
  );
}
