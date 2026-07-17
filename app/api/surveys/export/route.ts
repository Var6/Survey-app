import { handleError, requireDirector } from "@/lib/api";
import { surveysCol } from "@/lib/models";
import { buildSurveyFilter, attachMobiliserNames } from "@/lib/surveys";
import { buildSurveyWorkbook } from "@/lib/export";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const director = await requireDirector();
    const params = new URL(req.url).searchParams;
    const filter = buildSurveyFilter(director, params);

    const surveys = await surveysCol();
    const docs = await surveys
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(5000)
      .toArray();

    const rows = await attachMobiliserNames(docs);
    const buf = await buildSurveyWorkbook(rows);
    const date = new Date().toISOString().slice(0, 10);

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="janman-surveys-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
