import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import RoleNav from "@/components/RoleNav";

const NAV = [
  { href: "/mis", label: "Dashboard" },
  { href: "/mis/surveys", label: "Surveys" },
  { href: "/mis/reports", label: "CM Reports" },
  { href: "/mis/profile", label: "Profile" },
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
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <AppHeader name={user.name} roleLabel="Supervisor / MIS" avatarUrl={user.avatarUrl} />
      <RoleNav items={NAV} homeHref="/mis" />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
