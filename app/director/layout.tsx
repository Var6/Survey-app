import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppShell, { ShellNavGroup } from "@/components/AppShell";
import { pendingClosureCount } from "@/lib/nav-badges";

const NAV: ShellNavGroup[] = [
  { items: [{ href: "/director", label: "Overview", icon: "home" }] },
  {
    label: "Programme",
    items: [
      { href: "/director/surveys", label: "Surveys", icon: "survey" },
      { href: "/director/communities", label: "Communities", icon: "grid" },
      { href: "/director/frappe", label: "Funder sync", icon: "report" },
      { href: "/director/reports", label: "Reports", icon: "report" },
      { href: "/director/weekly", label: "Weekly reports", icon: "calendar" },
    ],
  },
  {
    label: "Case modules",
    items: [
      { href: "/director/cases", label: "All modules", icon: "grid", exact: true },
      { href: "/director/cases/health", label: "Health", icon: "health" },
      { href: "/director/cases/maternal", label: "Maternal & ICDS", icon: "maternal" },
      { href: "/director/cases/entitlements", label: "Entitlements", icon: "docs" },
      { href: "/director/cases/education", label: "Education", icon: "education" },
      { href: "/director/cases/early_childhood", label: "Early childhood", icon: "child" },
      { href: "/director/cases/youth", label: "Youth", icon: "youth" },
      { href: "/director/cases/women", label: "Women & girls", icon: "women" },
    ],
  },
  {
    label: "Administration",
    items: [
      { href: "/director/projects", label: "Projects & funds", icon: "project" },
      { href: "/director/users", label: "Users", icon: "users" },
      { href: "/director/finance", label: "Finance", icon: "finance" },
      { href: "/director/budget", label: "Budget", icon: "report" },
      { href: "/director/sync", label: "Frappe sync", icon: "sync" },
    ],
  },
  {
    label: "Field activity",
    items: [
      { href: "/director/cases/all", label: "All cases", icon: "check", exact: true },
      { href: "/director/camps", label: "Camps", icon: "camp" },
      { href: "/director/meetings", label: "Community meetings", icon: "users" },
      { href: "/director/notifications", label: "Notifications", icon: "bell" },
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

  // Badge on "All cases" = closure requests waiting for review.
  const pending = await pendingClosureCount();
  const nav = NAV.map((g) => ({
    ...g,
    items: g.items.map((it) =>
      it.href === "/director/cases/all" ? { ...it, label: "Cases & closure review", badge: pending } : it
    ),
  }));
  return (
    <AppShell
      name={user.name}
      roleLabel="Director"
      avatarUrl={user.avatarUrl}
      homeHref="/director"
      nav={nav}
      notificationsArea="/director"
    >
      {children}
    </AppShell>
  );
}
