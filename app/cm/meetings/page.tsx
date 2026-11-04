import { Suspense } from "react";
import MeetingsClient from "@/components/MeetingsClient";

export const metadata = { title: "Community meetings · Community Mobiliser" };

export default function MeetingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Loading meetings…</p>}>
      <MeetingsClient canCreate={true} />
    </Suspense>
  );
}
