import { PageTitle } from "@/components/ui";
import ProfileClient from "@/components/ProfileClient";

export const metadata = { title: "Profile · Programme Manager" };

export default function PmProfilePage() {
  return (
    <div>
      <PageTitle title="My profile" subtitle="Photo, details and password" />
      <ProfileClient />
    </div>
  );
}
