import { PageTitle } from "@/components/ui";
import ProfileClient from "@/components/ProfileClient";

export const metadata = { title: "Profile" };

export default function CmProfilePage() {
  return (
    <div>
      <PageTitle title="My profile" subtitle="Photo, details and password" />
      <ProfileClient />
    </div>
  );
}
