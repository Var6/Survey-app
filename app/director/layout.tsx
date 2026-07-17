import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import RoleNav from "@/components/RoleNav";

const NAV = [
  { href: "/director", label: "Overview" },
  { href: "/director/projects", label: "Projects" },
  { href: "/director/mobilisers", label: "Mobilisers" },
  { href: "/director/surveys", label: "Surveys" },
  { href: "/director/sync", label: "Sync" },
  { href: "/director/finance", label: "Finance" },
  { href: "/director/reports", label: "Reports" },
  { href: "/director/profile", label: "Profile" },
];

export default async function DirectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "director") redirect("/cm");

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <AppHeader name={user.name} roleLabel="Director" avatarUrl={user.avatarUrl} />
      <RoleNav items={NAV} homeHref="/director" />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
