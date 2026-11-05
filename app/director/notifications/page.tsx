import { PageTitle } from "@/components/ui";
import NotificationsClient from "@/components/NotificationsClient";

export const metadata = { title: "Notifications · Director" };

export default function NotificationsPage() {
  return (
    <div>
      <PageTitle title="Notifications" subtitle="Follow-ups, closure reviews, camps and meetings" />
      <NotificationsClient area="/director" categories={["followup_completed","closure_requested","closure_approved","closure_rejected","camp_created","camp_updated","meeting_created","meeting_updated","report_reminder","requisition_submitted","requisition_paid"]} />
    </div>
  );
}
