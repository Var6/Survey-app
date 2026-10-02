import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import SurveyForm from "@/components/SurveyForm";
import { settlementOptions } from "@/lib/settlements";
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

  // Live community list; a mobiliser with assigned communities sees only those.
  const all = await settlementOptions();
  const assigned = (user.communities || []).length
    ? all.filter((s) => (user.communities || []).includes(s.code))
    : [];
  const options = assigned.length ? assigned : all;

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
        settlementOptions={options}
        mobiliserCode={user.mobiliserCode || undefined}
        mobiliserName={user.name}
        resume={resume ?? undefined}
      />
    </div>
  );
}
