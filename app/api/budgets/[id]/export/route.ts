import { ObjectId } from "mongodb";
import { handleError, requireFinance, HttpError } from "@/lib/api";
import { budgetsCol } from "@/lib/models";
import { buildBudgetWorkbook } from "@/lib/export";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireFinance();
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      throw new HttpError(400, "Bad budget id");
    }
    const col = await budgetsCol();
    const doc = await col.findOne({ _id });
    if (!doc) throw new HttpError(404, "Budget not found");

    const buf = await buildBudgetWorkbook(doc);
    const safe = doc.name.replace(/[^a-z0-9-_]+/gi, "-").toLowerCase();
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="janman-budget-${safe}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
