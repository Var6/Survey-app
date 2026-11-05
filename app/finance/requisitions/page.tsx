import { Suspense } from "react";
import { PageTitle } from "@/components/ui";
import RequestsDesk from "@/components/RequestsDesk";

export const metadata = { title: "Requisitions & reimbursements" };

export default function FinanceRequisitionsPage() {
  return (
    <div>
      <PageTitle
        title="Requisitions & reimbursements"
        subtitle="Approve, reject and pay requests from the field team"
        back={{ href: "/finance", label: "Dashboard" }}
      />
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <RequestsDesk />
      </Suspense>
    </div>
  );
}
