import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import SurveyDetailView from "@/components/SurveyDetailView";
import PrintButton from "@/components/PrintButton";
import { loadSurveyDetail } from "@/lib/surveys";

export const metadata = { title: "Survey detail · Programme Manager" };

export default async function PmSurveyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const survey = await loadSurveyDetail(id, user);
  if (!survey) notFound();

  return (
    <div>
      <div className="print:hidden">
        <PageTitle
          title={survey.householdId}
          subtitle="Survey detail"
          back={{ href: "/pm/surveys", label: "Surveys" }}
          action={<PrintButton />}
        />
      </div>
      <SurveyDetailView survey={survey} />
    </div>
  );
}
