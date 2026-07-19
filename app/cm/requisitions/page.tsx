import { PageTitle } from "@/components/ui";
import RequisitionsClient from "@/components/RequisitionsClient";

export const metadata = { title: "Finance" };

export default function CmRequisitionsPage() {
  return (
    <div>
      <PageTitle
        title="Finance"
        subtitle="Request an advance, or claim a reimbursement with receipts"
      />
      <RequisitionsClient scope="cm" />
    </div>
  );
}
