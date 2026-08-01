import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import SurveyForm from "@/components/SurveyForm";
import { projectsCol } from "@/lib/models";
import { SETTLEMENTS } from "@/lib/questionnaire/settlements";
import { loadResumableSurvey } from "@/lib/surveys";

export const metadata = { title: "New survey · Programme Manager" };

async function getProjects() {
  try {
    const projects = await projectsCol();
    const list = await projects.find({}).sort({ createdAt: -1 }).toArray();
    return list.map((p) => ({ id: String(p._id), name: p.name }));
  } catch {
    return [];
  }
}

export default async function PmNewSurveyPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { resume: resumeId } = await searchParams;
  const resume = resumeId ? await loadResumableSurvey(resumeId, user) : null;

  const projects = await getProjects();
  const settlementOptions = SETTLEMENTS.map((s) => ({
    code: s.code,
    label: s.label,
  }));

  return (
    <div>
      <PageTitle
        title={resume ? "Resume survey" : "New survey"}
        subtitle={
          resume
            ? `Continue filling ${resume.householdId}`
            : "Record a household baseline survey"
        }
        back={{ href: "/pm/surveys" }}
      />
      <SurveyForm
        role="director"
        settlementOptions={settlementOptions}
        projects={projects}
        homePath="/pm/surveys"
        resume={resume ?? undefined}
      />
    </div>
  );
}
