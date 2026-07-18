import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import RoleNav from "@/components/RoleNav";

const NAV = [
  { href: "/pm", label: "Dashboard" },
  { href: "/pm/weekly", label: "Weekly report" },
  { href: "/pm/profile", label: "Profile" },
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
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <AppHeader name={user.name} roleLabel="Programme Manager" avatarUrl={user.avatarUrl} />
      <RoleNav items={NAV} homeHref="/pm" />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
