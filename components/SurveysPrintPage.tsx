import { surveysCol, type UserDoc } from "@/lib/models";
import {
  buildSurveyFilter,
  attachMobiliserNames,
  describeSurveyFilter,
  EXPORT_MAX_ROWS,
} from "@/lib/surveys";
import { settlementLabels } from "@/lib/settlements";
import { SURVEY_LINE_HEADERS, toSurveyLine } from "@/lib/survey-table";
import PrintButton from "@/components/PrintButton";
import { Empty } from "@/components/ui";

/**
 * Print / "Save as PDF" view of the survey list. Uses the same filter builder
 * as the list and both exports, so the PDF holds exactly the filtered records.
 */
export default async function SurveysPrintPage({
  user,
  params,
  backHref,
}: {
  user: UserDoc;
  params: Record<string, string | string[] | undefined>;
  backHref: string;
}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v) sp.set(k, v);

  const col = await surveysCol();
  const filter = buildSurveyFilter(user, sp);
  const total = await col.countDocuments(filter);

  if (total > EXPORT_MAX_ROWS) {
    return (
      <Empty>
        {total.toLocaleString("en-IN")} surveys match — too many for one PDF (limit{" "}
        {EXPORT_MAX_ROWS.toLocaleString("en-IN")}). Narrow the date range and print in parts.{" "}
        <a href={backHref} className="text-teal-600 underline">
          Back
        </a>
      </Empty>
    );
  }

  const docs = await col.find(filter).sort({ createdAt: -1, _id: -1 }).toArray();
  const rows = await attachMobiliserNames(docs);
  const labels = await settlementLabels();
  const lines = rows.map(({ survey, mobiliserName }) => toSurveyLine(survey, mobiliserName, labels));
  const filters = describeSurveyFilter(sp);
  const generated = new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Surveys — print / PDF</h1>
          <a href={backHref} className="text-sm text-teal-600 hover:underline dark:text-teal-400">
            ← Back to surveys
          </a>
        </div>
        <PrintButton />
      </div>

      <div className="mb-3">
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Janman · Household surveys</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-300">
          {lines.length.toLocaleString("en-IN")} survey{lines.length === 1 ? "" : "s"}
          {filters.length ? ` · ${filters.join(" · ")}` : " · all records"}
        </p>
        <p className="text-xs text-zinc-400">Generated {generated}</p>
      </div>

      {lines.length === 0 ? (
        <Empty>No surveys match these filters.</Empty>
      ) : (
        <table className="w-full border-collapse text-[11px]">
          <thead>
            <tr className="bg-zinc-100 text-left dark:bg-zinc-900">
              {SURVEY_LINE_HEADERS.map((h) => (
                <th key={h.key} className="border border-zinc-300 px-1.5 py-1 font-semibold">
                  {h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.householdId}>
                {SURVEY_LINE_HEADERS.map((h) => (
                  <td key={h.key} className="border border-zinc-300 px-1.5 py-0.5">
                    {l[h.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
