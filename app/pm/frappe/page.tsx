import { PageTitle } from "@/components/ui";
import FrappeSyncClient from "@/components/FrappeSyncClient";

export const metadata = { title: "Funder sync · Programme Manager" };

export default function FrappeSyncPage() {
  return (
    <div>
      <PageTitle
        title="Funder sync (Frappe)"
        subtitle="What the funder's system is receiving, field by field"
        back={{ href: "/pm", label: "Dashboard" }}
      />
      <FrappeSyncClient />
    </div>
  );
}
