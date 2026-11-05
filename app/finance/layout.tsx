import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppShell, { ShellNavGroup } from "@/components/AppShell";
import { openRequestCount } from "@/lib/finance/requests";

const NAV: ShellNavGroup[] = [
  {
    items: [
      { href: "/finance", label: "Dashboard", icon: "home", exact: true },
      { href: "/finance/requisitions", label: "Requisitions & reimbursements", icon: "check" },
      { href: "/finance/accounts", label: "Funds, expenses & payroll", icon: "finance" },
      { href: "/finance/budget", label: "Budget", icon: "report" },
    ],
  },
  {
    items: [
      { href: "/finance/notifications", label: "Notifications", icon: "bell" },
      { href: "/finance/profile", label: "Profile", icon: "profile" },
    ],
  },
];

export default async function FinanceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "accountant") {
    redirect(
      user.role === "director"
        ? "/director"
        : user.role === "programme_manager"
        ? "/pm"
        : user.role === "mis"
        ? "/mis"
        : "/cm"
    );
  }

  // Badge: requests waiting for a decision or for payment.
  const open = await openRequestCount();
  const nav = NAV.map((g) => ({
    ...g,
    items: g.items.map((it) =>
      it.href === "/finance/requisitions" ? { ...it, badge: open } : it
    ),
  }));

  return (
    <AppShell
      name={user.name}
      roleLabel="Accountant"
      avatarUrl={user.avatarUrl}
      homeHref="/finance"
      nav={nav}
      notificationsArea="/finance"
    >
      {children}
    </AppShell>
  );
}
