import { PageTitle } from "@/components/ui";
import UsersClient from "@/components/UsersClient";

export const metadata = { title: "Users · Director" };

export default function UsersPage() {
  return (
    <div>
      <PageTitle
        title="Users"
        subtitle="Manage directors, accountants and community mobilisers"
        back={{ href: "/director", label: "Overview" }}
      />
      <UsersClient />
    </div>
  );
}
