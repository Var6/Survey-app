import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import SurveyForm from "@/components/SurveyForm";
import { SETTLEMENTS, SETTLEMENT_BY_CODE } from "@/lib/questionnaire/settlements";
import { loadResumableSurvey } from "@/lib/surveys";

export const metadata = { title: "New survey" };

export default async function NewSurveyPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { resume: resumeId } = await searchParams;
  const resume = resumeId ? await loadResumableSurvey(resumeId, user) : null;

  const assigned = (user.communities || [])
    .map((c) => SETTLEMENT_BY_CODE[c])
    .filter(Boolean)
    .map((s) => ({ code: s!.code, label: s!.label }));

  const settlementOptions = assigned.length
    ? assigned
    : SETTLEMENTS.map((s) => ({ code: s.code, label: s.label }));

  return (
    <div>
      <PageTitle
        title={resume ? "Resume survey" : "Household baseline survey"}
        subtitle={
          resume
            ? `Continue filling ${resume.householdId}`
            : "Fill the form with the respondent"
        }
        back={{ href: "/cm", label: "Home" }}
      />
      <SurveyForm
        role="cm"
        settlementOptions={settlementOptions}
        mobiliserCode={user.mobiliserCode || undefined}
        mobiliserName={user.name}
        resume={resume ?? undefined}
      />
    </div>
  );
}
