"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch, formatDate } from "@/lib/client";
import { monthKey, monthLabel } from "@/lib/monthly/month";
import { MONTHLY_VARIANTS, type MonthlyVariantKey } from "@/lib/monthly/variants";
import { Card, Empty, btnPrimary, btnGhost } from "@/components/ui";

/* The author's own monthly reports: one card per month, newest first. New
   reports and continuing a draft go through basePath + "/new"; submitted ones
   open read-only at basePath + "/<id>". */

type Status = "draft" | "submitted" | "returned" | "approved";

interface Row {
  id: string;
  reportId: string;
  monthStart: string;
  monthEnd: string;
  status: Status;
  submittedAt: string | null;
  reviewedAt: string | null;
  directorComments: string | null;
}

// Same palette as the reviewer's list so a status looks identical everywhere.
const STATUS_CLS: Record<Status, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  returned: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
};

const STATUS_LABEL: Record<"hi" | "en", Record<Status, string>> = {
  en: { draft: "draft", submitted: "submitted", returned: "returned", approved: "approved" },
  hi: { draft: "ड्राफ्ट", submitted: "जमा", returned: "वापस", approved: "स्वीकृत" },
};

interface Props {
  /** The list route itself, e.g. "/cm/monthly". */
  basePath: string;
  variantKey: MonthlyVariantKey;
}

function MyMonthlyReportsList({ basePath, variantKey }: Props) {
  const hi = MONTHLY_VARIANTS[variantKey].lang === "hi";
  const router = useRouter();
  const params = useSearchParams();
  // Captured once on mount so the flash survives clearing the query below.
  const [flash, setFlash] = useState(() => params.get("submitted") === "1");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Drop ?submitted=1 so a refresh or a shared link does not re-show the flash.
  useEffect(() => {
    if (flash) router.replace(basePath, { scroll: false });
  }, [flash, router, basePath]);

  useEffect(() => {
    let alive = true;
    // The API already scopes cm/mis/pm callers to their own reports.
    apiFetch<{ reports: Row[] }>("/api/monthly?mine=1")
      .then(({ reports }) => {
        if (!alive) return;
        setRows(
          [...reports].sort(
            (a, b) => new Date(b.monthStart).getTime() - new Date(a.monthStart).getTime()
          )
        );
        setErr(null);
      })
      .catch((e) => alive && setErr((e as Error).message))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const printBase = basePath.replace(/\/monthly$/, "");

  return (
    <div className="space-y-4">
      {flash && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-sm font-medium text-teal-800 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-200"
        >
          <span>{hi ? "रिपोर्ट जमा हो गई ✓" : "Report submitted ✓"}</span>
          <button
            type="button"
            aria-label={hi ? "बंद करें" : "Dismiss"}
            className="rounded px-1.5 text-base leading-none text-teal-700 hover:bg-teal-100 dark:text-teal-300 dark:hover:bg-teal-900/60"
            onClick={() => setFlash(false)}
          >
            ×
          </button>
        </div>
      )}

      <Link href={`${basePath}/new`} className={`${btnPrimary} inline-block`}>
        {hi ? "+ नई मासिक रिपोर्ट" : "+ New monthly report"}
      </Link>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">{hi ? "लोड हो रहा है…" : "Loading…"}</p>
      ) : rows.length === 0 ? (
        <Empty>
          {hi
            ? "अभी कोई मासिक रिपोर्ट नहीं — पिछले महीने की रिपोर्ट से शुरू करें।"
            : "No monthly reports yet — start with the month that just finished."}
        </Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const month = monthKey(new Date(r.monthStart));
            const editable = r.status === "draft" || r.status === "returned";
            return (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 dark:text-zinc-50">
                      {monthLabel(month)}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {r.reportId}
                      {r.submittedAt &&
                        ` · ${hi ? "जमा " : "Submitted "}${formatDate(r.submittedAt)}`}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_CLS[r.status]}`}
                  >
                    {STATUS_LABEL[hi ? "hi" : "en"][r.status]}
                  </span>
                </div>

                {r.status === "returned" && (
                  <p className="mt-2 whitespace-pre-wrap rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                    <span className="font-semibold">{hi ? "सुधार हेतु वापस: " : "Returned: "}</span>
                    {r.directorComments ||
                      (hi ? "सुधार करके फिर से जमा करें।" : "Please correct and resubmit.")}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap gap-2">
                  {editable ? (
                    <Link href={`${basePath}/new?month=${month}`} className={btnPrimary}>
                      {hi ? "जारी रखें" : "Continue"}
                    </Link>
                  ) : (
                    <>
                      <Link href={`${basePath}/${r.id}`} className={btnGhost}>
                        {hi ? "देखें" : "View"}
                      </Link>
                      <Link href={`${printBase}/monthly-print?id=${r.id}`} className={btnGhost}>
                        PDF
                      </Link>
                    </>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** useSearchParams needs a Suspense boundary when a server page renders this. */
export default function MyMonthlyReportsClient(props: Props) {
  const hi = MONTHLY_VARIANTS[props.variantKey].lang === "hi";
  return (
    <Suspense
      fallback={
        <p className="text-sm text-zinc-500">{hi ? "लोड हो रहा है…" : "Loading…"}</p>
      }
    >
      <MyMonthlyReportsList {...props} />
    </Suspense>
  );
}
