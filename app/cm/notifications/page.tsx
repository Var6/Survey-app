import { PageTitle } from "@/components/ui";
import NotificationsClient from "@/components/NotificationsClient";

export const metadata = { title: "Notifications · Community Mobiliser" };

export default function NotificationsPage() {
  return (
    <div>
      <PageTitle title="Notifications" subtitle="Follow-ups, closure reviews, camps and meetings" />
      <NotificationsClient area="/cm" categories={["case_opened","closure_approved","closure_rejected","camp_created","camp_updated","meeting_invited","meeting_updated","report_reminder"]} />
    </div>
  );
}
