import { PageTitle } from "@/components/ui";
import ProfileClient from "@/components/ProfileClient";

export const metadata = { title: "Profile · Director" };

export default function DirectorProfilePage() {
  return (
    <div>
      <PageTitle title="My profile" subtitle="Photo, details and password" />
      <ProfileClient />
    </div>
  );
}
