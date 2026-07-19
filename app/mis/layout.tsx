import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppShell, { ShellNavGroup } from "@/components/AppShell";

const NAV: ShellNavGroup[] = [
  {
    items: [
      { href: "/mis", label: "Dashboard", icon: "home" },
      { href: "/mis/surveys", label: "Surveys", icon: "survey" },
      { href: "/mis/reports", label: "CM Reports", icon: "report" },
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
  return (
    <AppShell
      name={user.name}
      roleLabel="Supervisor / MIS"
      avatarUrl={user.avatarUrl}
      homeHref="/mis"
      nav={NAV}
    >
      {children}
    </AppShell>
  );
}
