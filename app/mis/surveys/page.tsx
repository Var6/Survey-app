import { Suspense } from "react";
import Link from "next/link";
import { PageTitle, btnPrimary } from "@/components/ui";
import SurveysClient from "@/components/SurveysClient";

export const metadata = { title: "Surveys · MIS" };

export default function MisSurveysPage() {
  return (
    <div>
      <PageTitle
        title="Surveys"
        subtitle="All household surveys — filter and review"
        action={
          <Link href="/mis/survey/new" className={btnPrimary}>
            + New survey
          </Link>
        }
      />
      <Suspense fallback={<p className="text-sm text-zinc-400">Loading…</p>}>
        <SurveysClient scope="mis" />
      </Suspense>
    </div>
  );
}
