import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppShell, { ShellNavGroup } from "@/components/AppShell";

const NAV: ShellNavGroup[] = [
  {
    items: [
      { href: "/finance", label: "Finance", icon: "finance" },
      { href: "/finance/budget", label: "Budget", icon: "report" },
    ],
  },
  { items: [{ href: "/finance/profile", label: "Profile", icon: "profile" }] },
];

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "accountant") {
    redirect(user.role === "director" ? "/director" : "/cm");
  }

  return (
    <AppShell
      name={user.name}
      roleLabel="Accountant"
      avatarUrl={user.avatarUrl}
      homeHref="/finance"
      nav={NAV}
    >
      {children}
    </AppShell>
  );
}
