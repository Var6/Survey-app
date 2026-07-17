import { PageTitle } from "@/components/ui";
import MobilisersClient from "@/components/MobilisersClient";

export const metadata = { title: "Mobilisers · Director" };

export default function MobilisersPage() {
  return (
    <div>
      <PageTitle
        title="Community Mobilisers"
        subtitle="Create CM logins and assign settlements"
        back={{ href: "/director", label: "Overview" }}
      />
      <MobilisersClient />
    </div>
  );
}
