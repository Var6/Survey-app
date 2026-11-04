import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import SurveysPrintPage from "@/components/SurveysPrintPage";

export const metadata = { title: "Surveys — print" };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const params = await searchParams;
  return <SurveysPrintPage user={user} params={params} backHref="/mis/surveys" />;
}
