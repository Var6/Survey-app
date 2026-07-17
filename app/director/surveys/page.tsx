import Link from "next/link";
import { PageTitle, btnPrimary } from "@/components/ui";
import SurveysClient from "@/components/SurveysClient";

export const metadata = { title: "Surveys · Director" };

export default function DirectorSurveysPage() {
  return (
    <div>
      <PageTitle
        title="Surveys"
        subtitle="All household surveys — filter and export"
        back={{ href: "/director", label: "Overview" }}
        action={
          <Link href="/director/surveys/new" className={btnPrimary}>
            + New
          </Link>
        }
      />
      <SurveysClient scope="director" />
    </div>
  );
}
