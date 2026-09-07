import { PageTitle } from "@/components/ui";
import UsersClient from "@/components/UsersClient";

export const metadata = { title: "Users · MIS" };

export default function MisUsersPage() {
  return (
    <div>
      <PageTitle
        title="Users"
        subtitle="Create and manage mobilisers and staff accounts"
        back={{ href: "/mis", label: "Dashboard" }}
      />
      {/* Director accounts remain Director-only, in the UI and in the API. */}
      <UsersClient canManageDirectors={false} />
    </div>
  );
}
