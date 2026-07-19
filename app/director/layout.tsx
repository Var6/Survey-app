import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppShell, { ShellNavGroup } from "@/components/AppShell";

const NAV: ShellNavGroup[] = [
  { items: [{ href: "/director", label: "Overview", icon: "home" }] },
  {
    label: "Programme",
    items: [
      { href: "/director/surveys", label: "Surveys", icon: "survey" },
      { href: "/director/reports", label: "Reports", icon: "report" },
      { href: "/director/weekly", label: "Weekly reports", icon: "calendar" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/director/projects", label: "Projects & funds", icon: "project" },
      { href: "/director/users", label: "Users", icon: "users" },
      { href: "/director/finance", label: "Finance", icon: "finance" },
      { href: "/director/sync", label: "Frappe sync", icon: "sync" },
    ],
  },
  { items: [{ href: "/director/profile", label: "Profile", icon: "profile" }] },
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
    <AppShell
      name={user.name}
      roleLabel="Director"
      avatarUrl={user.avatarUrl}
      homeHref="/director"
      nav={NAV}
    >
      {children}
    </AppShell>
  );
}
