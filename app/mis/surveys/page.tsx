import { PageTitle } from "@/components/ui";
import SurveysClient from "@/components/SurveysClient";

export const metadata = { title: "Surveys · MIS" };

export default function MisSurveysPage() {
  return (
    <div>
      <PageTitle title="Surveys" subtitle="All household surveys — filter and review" />
      <SurveysClient scope="mis" />
    </div>
  );
}
