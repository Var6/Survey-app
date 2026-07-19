import { ObjectId } from "mongodb";
import { json, handleError, requireRoles, readJson } from "@/lib/api";
import { monthlyReportsCol, type WeeklyActionPoint } from "@/lib/models";
import { publicMonthlyReport } from "@/lib/serialize";

export const runtime = "nodejs";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const director = await requireRoles("director");
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
          reviewedBy: director._id,
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
