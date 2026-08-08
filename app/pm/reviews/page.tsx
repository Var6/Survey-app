import { PageTitle } from "@/components/ui";
import MonthlyReviewClient from "@/components/MonthlyReviewClient";

export const metadata = { title: "Review monthly reports · Programme Manager" };

export default function PmReviewsPage() {
  return (
    <div>
      <PageTitle
        title="Team monthly reports"
        subtitle="Approve or return the Community Mobiliser and MIS monthly reports"
        back={{ href: "/pm", label: "Dashboard" }}
      />
      <MonthlyReviewClient scope="review" />
    </div>
  );
}
