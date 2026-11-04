import CmCaseDetail from "@/components/CmCaseDetail";

export const metadata = { title: "Case · Community Mobiliser" };

export default async function CmCasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CmCaseDetail caseId={id} />;
}
