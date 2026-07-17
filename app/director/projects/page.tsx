import { PageTitle } from "@/components/ui";
import ProjectsClient from "@/components/ProjectsClient";

export const metadata = { title: "Projects · Director" };

export default function ProjectsPage() {
  return (
    <div>
      <PageTitle
        title="Projects & funds"
        subtitle="Create funding projects and track balances"
        back={{ href: "/director", label: "Overview" }}
      />
      <ProjectsClient />
    </div>
  );
}
