import { ObjectId } from "mongodb";
import { monthlyReportsCol, usersCol, type UserDoc } from "@/lib/models";
import { buildMonthlyFilter } from "@/lib/monthly/query";
import { loadMonthlyReportForUser } from "@/lib/monthly/load";
import MonthlyReportPrint from "@/components/MonthlyReportPrint";
import PrintButton from "@/components/PrintButton";
import { Empty } from "@/components/ui";

/**
 * Hard-copy view: every monthly report matching the current filter, one per
 * page, ready for "Save as PDF" or a printer. Uses the same filter as the
 * on-screen list and the Excel export, so all three agree.
 */
export default async function MonthlyPrintPage({
  user,
  params,
  backHref,
}: {
  user: UserDoc;
  params: Record<string, string | string[] | undefined>;
  backHref: string;
}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (typeof v === "string" && v) sp.set(k, v);
  }

  const col = await monthlyReportsCol();

  // A single report is printed on its own with ?id=<report>. It is checked
  // against who may READ that report, not against the list filter — otherwise
  // a Programme Manager printing a Community Mobiliser's report (which the
  // "my reports" filter hides) got a blank page.
  const one = sp.get("id");
  let docs;
  if (one) {
    const loaded = await loadMonthlyReportForUser(one, user);
    docs = loaded ? [loaded.doc] : [];
  } else {
    const filter = buildMonthlyFilter(user, sp);
    docs = await col.find(filter).sort({ monthStart: -1, reportId: 1 }).limit(200).toArray();
  }

  const ids = [...new Set(docs.map((d) => String(d.programmeManagerId)))];
  const users = await usersCol();
  const uDocs = ids.length
    ? await users.find({ _id: { $in: ids.map((i) => new ObjectId(i)) } }).toArray()
    : [];
  const nameById = new Map(uDocs.map((u) => [String(u._id), u.name]));

  const statusLabel = sp.get("status") || "all statuses";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Monthly reports — print / PDF
          </h1>
          <p className="text-sm text-zinc-500">
            {docs.length} report{docs.length === 1 ? "" : "s"} ({statusLabel}) · one per page
          </p>
          <a href={backHref} className="text-sm text-teal-600 hover:underline dark:text-teal-400">
            ← Back to reports
          </a>
        </div>
        <PrintButton />
      </div>

      {docs.length === 0 ? (
        <div className="print:hidden">
          <Empty>No monthly reports match this filter yet.</Empty>
        </div>
      ) : (
        docs.map((doc, i) => (
          <div
            key={String(doc._id)}
            className={i < docs.length - 1 ? "print:break-after-page" : ""}
          >
            <div className="mb-6 rounded-xl border border-zinc-200 print:mb-0 print:rounded-none print:border-0 dark:border-zinc-800">
              <MonthlyReportPrint
                report={doc}
                authorName={nameById.get(String(doc.programmeManagerId))}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
