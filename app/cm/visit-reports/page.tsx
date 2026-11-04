import { Suspense } from "react";
import VisitRecordsClient from "@/components/VisitRecordsClient";

export const metadata = { title: "Visit reports · Community Mobiliser" };

export default function VisitReportsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Loading…</p>}>
      <VisitRecordsClient mode="cm" canDelete={false} />
    </Suspense>
  );
}
