import { Suspense } from "react";
import MeetingRecordsClient from "@/components/MeetingRecordsClient";

export const metadata = { title: "Camp reports · Director" };

export default function CampReportsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Loading…</p>}>
      <MeetingRecordsClient mode="staff" kind="camp" canDelete={true} />
    </Suspense>
  );
}
