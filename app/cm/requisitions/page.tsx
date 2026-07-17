import { PageTitle } from "@/components/ui";
import RequisitionsClient from "@/components/RequisitionsClient";

export const metadata = { title: "Requisitions" };

export default function CmRequisitionsPage() {
  return (
    <div>
      <PageTitle
        title="Requisitions"
        subtitle="Claim travel and field expenses with receipts"
      />
      <RequisitionsClient scope="cm" />
    </div>
  );
}
