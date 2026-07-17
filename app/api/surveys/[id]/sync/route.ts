import { json, handleError, requireDirector } from "@/lib/api";
import { syncSurveyById } from "@/lib/frappe";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireDirector();
    const { id } = await ctx.params;
    const sync = await syncSurveyById(id);
    return json({ sync });
  } catch (e) {
    return handleError(e);
  }
}
