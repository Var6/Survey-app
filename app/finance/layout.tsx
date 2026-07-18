import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import RoleNav from "@/components/RoleNav";

const NAV = [
  { href: "/finance", label: "Finance" },
  { href: "/finance/profile", label: "Profile" },
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
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <AppHeader name={user.name} roleLabel="Accountant" avatarUrl={user.avatarUrl} />
      <RoleNav items={NAV} homeHref="/finance" />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
