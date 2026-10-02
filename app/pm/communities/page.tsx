import { PageTitle } from "@/components/ui";
import CommunitiesClient from "@/components/CommunitiesClient";

export const metadata = { title: "Communities · Programme Manager" };

export default function CommunitiesPage() {
  return (
    <div>
      <PageTitle
        title="Communities"
        subtitle="Add or rename a community, and assign mobilisers to it"
        back={{ href: "/pm", label: "Dashboard" }}
      />
      <CommunitiesClient />
    </div>
  );
}
