import { notFound } from "next/navigation";
import CaseQueue from "@/components/CaseQueue";
import { MODULES, CaseModule } from "@/lib/cases/modules";

export default async function Page({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (!(module in MODULES)) notFound();
  return <CaseQueue basePath="/pm" module={module as CaseModule} />;
}
