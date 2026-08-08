import { ObjectId } from "mongodb";
import { json, handleError, requireRoles } from "@/lib/api";
import { monthlyReportsCol } from "@/lib/models";
import { publicMonthlyReport } from "@/lib/serialize";
import { variantForAuthorRole } from "@/lib/monthly/variants";

export const runtime = "nodejs";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("programme_manager", "cm", "mis");
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }

    const col = await monthlyReportsCol();
    const doc = await col.findOne({ _id });
    if (!doc) return json({ error: "Report not found" }, 404);

    const author = doc.authorRole || "programme_manager";
    if (author !== user.role) return json({ error: "Forbidden" }, 403);
    // Single-PM programme: any programme_manager may submit the month's report.
    if (user.role !== "programme_manager" && String(doc.programmeManagerId) !== String(user._id)) {
      return json({ error: "Forbidden" }, 403);
    }
    if (doc.status !== "draft" && doc.status !== "returned") {
      return json({ error: "Report already submitted" }, 409);
    }

    const variant = variantForAuthorRole(doc.authorRole);
    const data = doc.data || {};
    const cert = doc.certification || {};
    const issues: string[] = [];

    for (const rule of variant.required) {
      const v = data[rule.field];
      const empty =
        v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
      if (empty) issues.push(rule.message);
    }
    if (variant.certification.some((c) => !cert[c.key])) {
      issues.push(
        variant.lang === "hi"
          ? "घोषणा वाले सभी बॉक्स टिक करें।"
          : "All certification boxes must be checked."
      );
    }
    if (
      variant.hasSettlementControl &&
      (doc.settlements || []).some((s) => s.status === "red" && (!s.reason || !s.corrective))
    ) {
      issues.push("Every Red settlement needs a reason and corrective action.");
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
    return json({ report: publicMonthlyReport(updated!, { pmName: user.name }) });
  } catch (e) {
    return handleError(e);
  }
}
