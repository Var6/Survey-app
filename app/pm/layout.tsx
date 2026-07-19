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
    label: "Reporting",
    items: [
      { href: "/pm/weekly", label: "Weekly report", icon: "report" },
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
