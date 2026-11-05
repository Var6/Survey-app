import { PageTitle } from "@/components/ui";
import NotificationsClient from "@/components/NotificationsClient";

export const metadata = { title: "Notifications · Finance" };

export default function FinanceNotificationsPage() {
  return (
    <div>
      <PageTitle title="Notifications" subtitle="New requests and payments" />
      <NotificationsClient area="/finance" categories={["requisition_submitted", "requisition_paid"]} />
    </div>
  );
}
