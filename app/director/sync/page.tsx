import { PageTitle } from "@/components/ui";
import SyncClient from "@/components/SyncClient";

export const metadata = { title: "Frappe sync · Director" };

export default function SyncPage() {
  return (
    <div>
      <PageTitle
        title="Frappe sync"
        subtitle="Monitor sync status and re-sync failed records"
        back={{ href: "/director", label: "Overview" }}
      />
      <SyncClient />
    </div>
  );
}
