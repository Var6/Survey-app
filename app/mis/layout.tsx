import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppShell, { ShellNavGroup } from "@/components/AppShell";
import { pendingClosureCount } from "@/lib/nav-badges";

const NAV: ShellNavGroup[] = [
  {
    items: [
      { href: "/mis", label: "Dashboard", icon: "home" },
      { href: "/mis/surveys", label: "Surveys", icon: "survey" },
      { href: "/mis/survey/new", label: "New survey", icon: "grid" },
      { href: "/mis/reports", label: "All reports", icon: "report" },
      { href: "/mis/monthly", label: "My monthly reports", icon: "calendar" },
      { href: "/mis/users", label: "Users", icon: "profile" },
      { href: "/mis/communities", label: "Communities", icon: "grid" },
      { href: "/mis/frappe", label: "Funder sync", icon: "report" },
    ],
  },
  {
    label: "Case modules",
    items: [
      { href: "/mis/cases", label: "All modules", icon: "grid", exact: true },
      { href: "/mis/cases/health", label: "Health", icon: "health" },
      { href: "/mis/cases/maternal", label: "Maternal & ICDS", icon: "maternal" },
      { href: "/mis/cases/entitlements", label: "Entitlements", icon: "docs" },
      { href: "/mis/cases/education", label: "Education", icon: "education" },
      { href: "/mis/cases/early_childhood", label: "Early childhood", icon: "child" },
      { href: "/mis/cases/youth", label: "Youth", icon: "youth" },
      { href: "/mis/cases/women", label: "Women & girls", icon: "women" },
    ],
  },
  {
    label: "Field activity",
    items: [
      { href: "/mis/cases/all", label: "All cases", icon: "check", exact: true },
      { href: "/mis/support", label: "Support & follow-up", icon: "docs" },
      { href: "/mis/camp-reports", label: "Camp reports", icon: "camp" },
      { href: "/mis/visit-reports", label: "Visit reports", icon: "users" },
      { href: "/mis/camps", label: "Planned camps", icon: "camp" },
      { href: "/mis/meeting-reports", label: "Meeting reports", icon: "survey" },
      { href: "/mis/meetings", label: "Planned meetings", icon: "users" },
      { href: "/mis/notifications", label: "Notifications", icon: "bell" },
    ],
  },
  { items: [{ href: "/mis/profile", label: "Profile", icon: "profile" }] },
];

export default async function MisLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "mis") {
    redirect(
      user.role === "director"
        ? "/director"
        : user.role === "accountant"
        ? "/finance"
        : user.role === "programme_manager"
        ? "/pm"
        : "/cm"
    );
  }
  // Badge on "All cases" = closure requests waiting for review.
  const pending = await pendingClosureCount();
  const nav = NAV.map((g) => ({
    ...g,
    items: g.items.map((it) =>
      it.href === "/mis/cases/all" ? { ...it, label: "Cases & closure review", badge: pending } : it
    ),
  }));
  return (
    <AppShell
      name={user.name}
      roleLabel="Supervisor / MIS"
      avatarUrl={user.avatarUrl}
      homeHref="/mis"
      nav={nav}
      notificationsArea="/mis"
    >
      {children}
    </AppShell>
  );
}
