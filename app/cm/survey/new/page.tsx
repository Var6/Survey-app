import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import SurveyForm from "@/components/SurveyForm";
import { SETTLEMENTS, SETTLEMENT_BY_CODE } from "@/lib/questionnaire/settlements";

export const metadata = { title: "New survey" };

export default async function NewSurveyPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const assigned = (user.communities || [])
    .map((c) => SETTLEMENT_BY_CODE[c])
    .filter(Boolean)
    .map((s) => ({ code: s!.code, label: s!.label }));

  const settlementOptions = assigned.length
    ? assigned
    : SETTLEMENTS.map((s) => ({ code: s.code, label: s.label }));

  return (
    <div>
      <PageTitle
        title="Household baseline survey"
        subtitle="Fill the form with the respondent"
        back={{ href: "/cm", label: "Home" }}
      />
      <SurveyForm
        role="cm"
        settlementOptions={settlementOptions}
        mobiliserCode={user.mobiliserCode || undefined}
        mobiliserName={user.name}
      />
    </div>
  );
}
