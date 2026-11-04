import { Suspense } from "react";
import { notFound } from "next/navigation";
import CaseQueue from "@/components/CaseQueue";
import { MODULES, CaseModule } from "@/lib/cases/modules";

export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (module !== "all" && !(module in MODULES)) notFound();
  return (
    <Suspense fallback={<p className="text-sm text-zinc-400">Loading cases…</p>}>
      <CaseQueue basePath="/pm" module={module as CaseModule | "all"} />
    </Suspense>
  );
}
