import { Suspense } from "react";
import VisitRecordsClient from "@/components/VisitRecordsClient";

export const metadata = { title: "Visit reports · Programme Manager" };

export default function VisitReportsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Loading…</p>}>
      <VisitRecordsClient mode="staff" canDelete={false} />
    </Suspense>
  );
}
