import { Suspense } from "react";
import MeetingsClient from "@/components/MeetingsClient";

export const metadata = { title: "Planned meetings · MIS" };

export default function MeetingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Loading meetings…</p>}>
      <MeetingsClient canCreate={false} />
    </Suspense>
  );
}
