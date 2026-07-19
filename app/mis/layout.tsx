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
