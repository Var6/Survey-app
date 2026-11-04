import { PageTitle } from "@/components/ui";
import NotificationsClient from "@/components/NotificationsClient";

export const metadata = { title: "Notifications · MIS" };

export default function NotificationsPage() {
  return (
    <div>
      <PageTitle title="Notifications" subtitle="Follow-ups, closure reviews, camps and meetings" />
      <NotificationsClient area="/mis" categories={["followup_completed","closure_requested","closure_approved","closure_rejected","camp_created","camp_updated","meeting_created","meeting_updated","report_reminder"]} />
    </div>
  );
}
