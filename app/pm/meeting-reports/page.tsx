import { Suspense } from "react";
import MeetingRecordsClient from "@/components/MeetingRecordsClient";

export const metadata = { title: "Meeting reports · Programme Manager" };

export default function MeetingReportsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Loading…</p>}>
      <MeetingRecordsClient mode="staff" canDelete={false} />
    </Suspense>
  );
}
