import { Suspense } from "react";
import SupportRecordsClient from "@/components/SupportRecordsClient";

export const metadata = { title: "Support & follow-up · Director" };

export default function SupportPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Loading…</p>}>
      <SupportRecordsClient mode="staff" canDelete={true} />
    </Suspense>
  );
}
