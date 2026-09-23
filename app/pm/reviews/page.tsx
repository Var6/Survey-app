import { PageTitle } from "@/components/ui";
import MonthlyReviewClient from "@/components/MonthlyReviewClient";
import Link from "next/link";

export const metadata = { title: "Review monthly reports · Programme Manager" };

export default function PmReviewsPage() {
  return (
    <div>
      <PageTitle
        title="Team monthly reports"
        subtitle="Approve or return the Community Mobiliser and MIS monthly reports"
        back={{ href: "/pm", label: "Dashboard" }}
        action={
          <Link
            href="/pm/monthly-print?scope=review"
            className="rounded-lg border border-teal-600 bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            ⬇ Download PDF
          </Link>
        }
      />
      <MonthlyReviewClient scope="review" printBase="/pm" />
    </div>
  );
}
