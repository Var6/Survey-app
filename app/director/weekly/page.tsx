import { PageTitle } from "@/components/ui";
import WeeklyReviewClient from "@/components/WeeklyReviewClient";

export const metadata = { title: "Weekly reports · Director" };

export default function DirectorWeeklyPage() {
  return (
    <div>
      <PageTitle
        title="Weekly reports"
        subtitle="Review and approve Programme Manager weekly reports"
        back={{ href: "/director", label: "Overview" }}
      />
      <WeeklyReviewClient />
    </div>
  );
}
