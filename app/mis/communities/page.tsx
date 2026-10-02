import { PageTitle } from "@/components/ui";
import CommunitiesClient from "@/components/CommunitiesClient";

export const metadata = { title: "Communities · MIS" };

export default function CommunitiesPage() {
  return (
    <div>
      <PageTitle
        title="Communities"
        subtitle="Add or rename a community, and assign mobilisers to it"
        back={{ href: "/mis", label: "Dashboard" }}
      />
      <CommunitiesClient />
    </div>
  );
}
