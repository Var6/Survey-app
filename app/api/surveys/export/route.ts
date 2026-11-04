import { json, handleError, requireRoles } from "@/lib/api";
import { surveysCol } from "@/lib/models";
import {
  buildSurveyFilter,
  attachMobiliserNames,
  describeSurveyFilter,
  EXPORT_MAX_ROWS,
} from "@/lib/surveys";
import { buildSurveyWorkbook } from "@/lib/export";
import { settlementLabels } from "@/lib/settlements";
import { surveyLinesToCsv, toSurveyLine } from "@/lib/survey-table";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Survey export — Excel (default) or CSV (`format=csv`). Both use the same
 * filter as the on-screen list (settlement, status, sync, mobiliser and the
 * date range), so the file holds exactly the matching records — all of them,
 * not just the page on screen. If the match is larger than we can build in
 * one request we say so instead of silently cutting rows off.
 */
export async function GET(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager");
    const params = new URL(req.url).searchParams;
    const filter = buildSurveyFilter(user, params);
    const format = params.get("format") === "csv" ? "csv" : "xlsx";

    const surveys = await surveysCol();
    const total = await surveys.countDocuments(filter);
    if (total > EXPORT_MAX_ROWS) {
      return json(
        {
          error: `${total.toLocaleString("en-IN")} surveys match — too many for one file (limit ${EXPORT_MAX_ROWS.toLocaleString("en-IN")}). Narrow the date range and export in parts.`,
        },
        413
      );
    }

    const docs = await surveys.find(filter).sort({ createdAt: -1, _id: -1 }).toArray();
    const rows = await attachMobiliserNames(docs);
    const labels = await settlementLabels();

    const stamp =
      params.get("from") || params.get("to")
        ? `${params.get("from") || "start"}_to_${params.get("to") || "today"}`
        : new Date().toISOString().slice(0, 10);

    const common = {
      "Cache-Control": "no-store",
      "X-Total-Rows": String(rows.length),
      "X-Filters": encodeURIComponent(describeSurveyFilter(params).join("; ")),
    };

    if (format === "csv") {
      const csv = surveyLinesToCsv(
        rows.map(({ survey, mobiliserName }) => toSurveyLine(survey, mobiliserName, labels))
      );
      return new Response(csv, {
        status: 200,
        headers: {
          ...common,
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="janman-surveys-${stamp}.csv"`,
        },
      });
    }

    const buf = await buildSurveyWorkbook(rows, labels);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        ...common,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="janman-surveys-${stamp}.xlsx"`,
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
