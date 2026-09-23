import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import MonthlyPrintPage from "@/components/MonthlyPrintPage";

export const metadata = { title: "Monthly reports — print · Director" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  return <MonthlyPrintPage user={user} params={params} backHref="/director/reports" />;
}
