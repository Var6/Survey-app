import { json, handleError, requireRoles, readJson } from "@/lib/api";
import { caseFollowupsCol } from "@/lib/models";
import { publicFollowup } from "@/lib/serialize";
import { assertCanView, loadCase, recordFollowup, type FollowupInput } from "@/lib/cases/service";

export const runtime = "nodejs";

/** Submitted follow-ups on a case (the CM's own draft, if any, comes with them). */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const { id } = await ctx.params;
    const c = await loadCase(id);
    assertCanView(user, c);
    const col = await caseFollowupsCol();
    const docs = await col
      .find({
        caseId: c._id,
        $or: [
          { status: "submitted" as const },
          ...(user.role === "cm" ? [{ status: "draft" as const, cmId: user._id }] : []),
        ],
      })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    return json({ followups: docs.map(publicFollowup) });
  } catch (e) {
    return handleError(e);
  }
}

/** CM saves a draft or submits a follow-up. Submitting notifies MIS and the PM. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("cm");
    const { id } = await ctx.params;
    const body = await readJson<FollowupInput>(req);
    const { followup, duplicate } = await recordFollowup(user, id, body);
    return json({ followup: publicFollowup(followup), duplicate }, duplicate ? 200 : 201);
  } catch (e) {
    return handleError(e);
  }
}
