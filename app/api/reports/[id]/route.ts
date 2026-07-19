import { ObjectId } from "mongodb";
import { json, handleError, requireDirector } from "@/lib/api";
import { reportsCol } from "@/lib/models";

export const runtime = "nodejs";

/** Director-only: delete a daily/weekly/monthly field report. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireDirector();
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }
    const reports = await reportsCol();
    const res = await reports.deleteOne({ _id });
    if (!res.deletedCount) return json({ error: "Report not found" }, 404);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
