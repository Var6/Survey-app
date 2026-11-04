import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppShell, { ShellNavGroup } from "@/components/AppShell";
import { pendingClosureCount } from "@/lib/nav-badges";

const NAV: ShellNavGroup[] = [
  {
    items: [
      { href: "/pm", label: "Dashboard", icon: "home" },
    ],
  },
  {
    label: "Surveys",
    items: [
      { href: "/pm/surveys", label: "Surveys", icon: "survey" },
      { href: "/pm/communities", label: "Communities", icon: "grid" },
      { href: "/pm/frappe", label: "Funder sync", icon: "report" },
      { href: "/pm/survey/new", label: "New survey", icon: "grid" },
    ],
  },
  {
    label: "Case modules",
    items: [
      { href: "/pm/cases", label: "All modules", icon: "grid", exact: true },
      { href: "/pm/cases/health", label: "Health", icon: "health" },
      { href: "/pm/cases/maternal", label: "Maternal & ICDS", icon: "maternal" },
      { href: "/pm/cases/entitlements", label: "Entitlements", icon: "docs" },
      { href: "/pm/cases/education", label: "Education", icon: "education" },
      { href: "/pm/cases/early_childhood", label: "Early childhood", icon: "child" },
      { href: "/pm/cases/youth", label: "Youth", icon: "youth" },
      { href: "/pm/cases/women", label: "Women & girls", icon: "women" },
    ],
  },
  {
    label: "Reporting",
    items: [
      { href: "/pm/daily", label: "Daily update", icon: "survey" },
      { href: "/pm/weekly", label: "Weekly report", icon: "report" },
      { href: "/pm/monthly", label: "My monthly reports", icon: "calendar" },
      { href: "/pm/reviews", label: "Team monthly reports", icon: "report" },
    ],
  },
  {
    label: "Field activity",
    items: [
      { href: "/pm/cases/all", label: "All cases", icon: "check", exact: true },
      { href: "/pm/camps", label: "Camps", icon: "camp" },
      { href: "/pm/meeting-reports", label: "Meeting reports", icon: "survey" },
      { href: "/pm/meetings", label: "Planned meetings", icon: "users" },
      { href: "/pm/notifications", label: "Notifications", icon: "bell" },
    ],
  },
  { items: [{ href: "/pm/profile", label: "Profile", icon: "profile" }] },
];

export default async function PmLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "programme_manager") {
    redirect(
      user.role === "director"
        ? "/director"
        : user.role === "accountant"
        ? "/finance"
        : user.role === "mis"
        ? "/mis"
        : "/cm"
    );
  }
  // Badge on "All cases" = closure requests waiting for review.
  const pending = await pendingClosureCount();
  const nav = NAV.map((g) => ({
    ...g,
    items: g.items.map((it) =>
      it.href === "/pm/cases/all" ? { ...it, label: "Cases & closure review", badge: pending } : it
    ),
  }));
  return (
    <AppShell
      name={user.name}
      roleLabel="Programme Manager"
      avatarUrl={user.avatarUrl}
      homeHref="/pm"
      nav={nav}
      notificationsArea="/pm"
    >
      {children}
    </AppShell>
  );
}
