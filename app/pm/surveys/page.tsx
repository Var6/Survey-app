import Link from "next/link";
import { PageTitle, btnPrimary } from "@/components/ui";
import SurveysClient from "@/components/SurveysClient";

export const metadata = { title: "Surveys · Programme Manager" };

export default function PmSurveysPage() {
  return (
    <div>
      <PageTitle
        title="Surveys"
        subtitle="All household surveys — filter and review"
        action={
          <Link href="/pm/survey/new" className={btnPrimary}>
            + New survey
          </Link>
        }
      />
      <SurveysClient scope="mis" />
    </div>
  );
}
