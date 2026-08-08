import { ObjectId } from "mongodb";
import { json, handleError, requireRoles, readJson } from "@/lib/api";
import { monthlyReportsCol, type WeeklyActionPoint } from "@/lib/models";
import { publicMonthlyReport } from "@/lib/serialize";
import { variantForAuthorRole } from "@/lib/monthly/variants";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const reviewer = await requireRoles("director", "programme_manager");
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }

    const { action, comments, actionPoints } = await readJson<{
      action?: "approve" | "return";
      comments?: string;
      actionPoints?: WeeklyActionPoint[];
    }>(req);
    if (action !== "approve" && action !== "return") {
      return json({ error: "action must be 'approve' or 'return'" }, 400);
    }

    const col = await monthlyReportsCol();
    const doc = await col.findOne({ _id });
    if (!doc) return json({ error: "Report not found" }, 404);

    // CM and MIS monthlies are approved by the Programme Manager; the
    // Programme Manager's own monthly is approved by the Director.
    const variant = variantForAuthorRole(doc.authorRole);
    if (reviewer.role !== variant.reviewerRole) {
      return json(
        { error: `Only the ${variant.reviewerRole.replace("_", " ")} reviews this report` },
        403
      );
    }
    if (doc.status !== "submitted") {
      return json({ error: "Only submitted reports can be reviewed" }, 409);
    }

    const now = new Date();
    await col.updateOne(
      { _id },
      {
        $set: {
          status: action === "approve" ? "approved" : "returned",
          directorComments: comments?.trim() || undefined,
          directorActionPoints: Array.isArray(actionPoints) ? actionPoints : [],
          reviewedBy: reviewer._id,
          reviewedAt: now,
          updatedAt: now,
        },
      }
    );
    const updated = await col.findOne({ _id });
    return json({ report: publicMonthlyReport(updated!) });
  } catch (e) {
    return handleError(e);
  }
}
