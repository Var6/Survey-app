import { redirect, notFound } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { PageTitle } from "@/components/ui";
import MonthlyReportPrint from "@/components/MonthlyReportPrint";
import PrintButton from "@/components/PrintButton";
import { loadMonthlyReportForUser } from "@/lib/monthly/load";
import { monthKey, monthLabel } from "@/lib/monthly/month";
import type { WeeklyStatus } from "@/lib/models";

export const metadata = { title: "मासिक रिपोर्ट · Monthly report" };

const STATUS_LABEL: Record<WeeklyStatus, string> = {
  draft: "ड्राफ्ट",
  submitted: "जमा",
  returned: "वापस",
  approved: "स्वीकृत",
};

export default async function CmMonthlyReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const loaded = await loadMonthlyReportForUser(id, user);
  if (!loaded) notFound();

  const { doc, authorName } = loaded;

  return (
    <div>
      <div className="print:hidden">
        <PageTitle
          title={`${monthLabel(monthKey(doc.monthStart))} · ${STATUS_LABEL[doc.status]}`}
          subtitle={doc.reportId}
          back={{ href: "/cm/monthly", label: "मेरी रिपोर्ट" }}
          action={<PrintButton />}
        />
      </div>
      <MonthlyReportPrint report={doc} authorName={authorName} />
    </div>
  );
}
