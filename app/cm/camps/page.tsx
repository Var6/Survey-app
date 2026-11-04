import { Suspense } from "react";
import CampsClient from "@/components/CampsClient";

export const metadata = { title: "Planned camps · Community Mobiliser" };

export default function CampsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Loading camps…</p>}>
      <CampsClient canManage={false} />
    </Suspense>
  );
}
