import { json, handleError, requireRoles, readJson } from "@/lib/api";
import { publicClosure } from "@/lib/serialize";
import { requestClosure, reviewClosure } from "@/lib/cases/service";

export const runtime = "nodejs";

/** CM asks for the case to be closed (does NOT close it). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("cm");
    const { id } = await ctx.params;
    const body = await readJson<{ note?: string }>(req);
    const closure = await requestClosure(user, id, body.note);
    return json({ closure: publicClosure(closure) }, 201);
  } catch (e) {
    return handleError(e);
  }
}

/** Director / MIS / PM approve or reject the closure request. */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager");
    const { id } = await ctx.params;
    const body = await readJson<{ decision?: "approve" | "reject"; reason?: string }>(req);
    const result = await reviewClosure(user, id, body.decision as "approve" | "reject", body.reason);
    return json({
      outcome: result.outcome,
      closure: publicClosure(result.closure),
      waiting: "waiting" in result ? result.waiting : [],
    });
  } catch (e) {
    return handleError(e);
  }
}
