import { Suspense } from "react";
import Link from "next/link";
import { PageTitle, btnPrimary } from "@/components/ui";
import SurveysClient from "@/components/SurveysClient";

export const metadata = { title: "My surveys" };

export default function CmSurveysPage() {
  return (
    <div>
      <PageTitle
        title="My surveys"
        subtitle="Households you have surveyed"
        action={
          <Link href="/cm/survey/new" className={btnPrimary}>
            + New
          </Link>
        }
      />
      <Suspense fallback={<p className="text-sm text-zinc-400">Loading…</p>}>
        <SurveysClient scope="cm" />
      </Suspense>
    </div>
  );
}
