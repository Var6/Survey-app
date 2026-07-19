import { ObjectId } from "mongodb";
import { json, handleError, requireRoles } from "@/lib/api";
import { weeklyReportsCol } from "@/lib/models";
import { publicWeeklyReport } from "@/lib/serialize";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const pm = await requireRoles("programme_manager");
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }

    const col = await weeklyReportsCol();
    const doc = await col.findOne({ _id });
    if (!doc) return json({ error: "Report not found" }, 404);
    // Single-PM programme: any programme_manager may submit the week's report.
    if (doc.status !== "draft" && doc.status !== "returned") {
      return json({ error: "Report already submitted" }, 409);
    }

    // Submission-blocking validations (PMW §18)
    const data = doc.data || {};
    const cert = doc.certification || {};
    const issues: string[] = [];
    if (!data.overall_status) issues.push("Overall project status (Section A) is required.");
    if (!data.next_week_priorities) issues.push("Next-week priorities (Section M) are required.");
    for (const k of ["cert_01", "cert_02", "cert_03", "cert_04"]) {
      if (!cert[k]) {
        issues.push("All certification boxes (Section N) must be checked.");
        break;
      }
    }
    if ((doc.settlements || []).some((s) => s.status === "red" && (!s.reason || !s.corrective))) {
      issues.push("Every Red settlement needs a reason and corrective action (Section B).");
    }

    if (issues.length) {
      return json({ error: "Cannot submit yet", issues }, 400);
    }

    const now = new Date();
    await col.updateOne(
      { _id },
      { $set: { status: "submitted", submittedAt: now, updatedAt: now } }
    );
    const updated = await col.findOne({ _id });
    return json({ report: publicWeeklyReport(updated!, { pmName: pm.name }) });
  } catch (e) {
    return handleError(e);
  }
}
