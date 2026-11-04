import { Suspense } from "react";
import SupportRecordsClient from "@/components/SupportRecordsClient";

export const metadata = { title: "Support & follow-up · Community Mobiliser" };

export default function SupportPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Loading…</p>}>
      <SupportRecordsClient mode="cm" canDelete={false} />
    </Suspense>
  );
}
