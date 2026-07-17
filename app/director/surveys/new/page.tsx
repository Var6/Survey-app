import { PageTitle } from "@/components/ui";
import SurveyForm from "@/components/SurveyForm";
import { projectsCol } from "@/lib/models";
import { SETTLEMENTS } from "@/lib/questionnaire/settlements";

export const metadata = { title: "New survey · Director" };

async function getProjects() {
  try {
    const projects = await projectsCol();
    const list = await projects.find({}).sort({ createdAt: -1 }).toArray();
    return list.map((p) => ({ id: String(p._id), name: p.name }));
  } catch {
    return [];
  }
}

export default async function DirectorNewSurveyPage() {
  const projects = await getProjects();
  const settlementOptions = SETTLEMENTS.map((s) => ({
    code: s.code,
    label: s.label,
  }));

  return (
    <div>
      <PageTitle
        title="New survey"
        subtitle="Record a household baseline survey"
        back={{ href: "/director/surveys", label: "Surveys" }}
      />
      <SurveyForm role="director" settlementOptions={settlementOptions} projects={projects} />
    </div>
  );
}
