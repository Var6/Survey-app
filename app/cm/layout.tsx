import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import AppHeader from "@/components/AppHeader";
import RoleNav from "@/components/RoleNav";

const NAV = [
  { href: "/cm", label: "Home" },
  { href: "/cm/surveys", label: "Surveys" },
  { href: "/cm/requisitions", label: "Requisitions" },
  { href: "/cm/reports", label: "Reports" },
  { href: "/cm/profile", label: "Profile" },
];

export default async function CmLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (user.role !== "cm") redirect("/director");

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <AppHeader
        name={user.name}
        roleLabel="Community Mobiliser"
        avatarUrl={user.avatarUrl}
      />
      <RoleNav items={NAV} homeHref="/cm" />
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}
