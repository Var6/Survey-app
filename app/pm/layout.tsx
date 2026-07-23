import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppShell, { ShellNavGroup } from "@/components/AppShell";

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
      { href: "/pm/monthly", label: "Monthly report", icon: "calendar" },
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
  return (
    <AppShell
      name={user.name}
      roleLabel="Programme Manager"
      avatarUrl={user.avatarUrl}
      homeHref="/pm"
      nav={NAV}
    >
      {children}
    </AppShell>
  );
}
