import { ObjectId } from "mongodb";
import { json, handleError, requireRoles, readJson } from "@/lib/api";
import { weeklyReportsCol, usersCol, type SettlementStatus } from "@/lib/models";
import { publicWeeklyReport } from "@/lib/serialize";
import { weekOf, computeDashboard } from "@/lib/weekly/dashboard";

export const runtime = "nodejs";

function oid(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("programme_manager", "director", "mis");
    const { id } = await ctx.params;
    const _id = oid(id);
    if (!_id) return json({ error: "Invalid id" }, 400);

    const col = await weeklyReportsCol();
    const doc = await col.findOne({ _id });
    if (!doc) return json({ error: "Report not found" }, 404);
    if (user.role === "programme_manager" && String(doc.programmeManagerId) !== String(user._id)) {
      return json({ error: "Forbidden" }, 403);
    }

    const users = await usersCol();
    const pm = await users.findOne({ _id: doc.programmeManagerId });
    return json({ report: publicWeeklyReport(doc, { pmName: pm?.name }) });
  } catch (e) {
    return handleError(e);
  }
}

/** Director-only: delete a weekly report (e.g. duplicates / test data). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRoles("director");
    const { id } = await ctx.params;
    const _id = oid(id);
    if (!_id) return json({ error: "Invalid id" }, 400);
    const col = await weeklyReportsCol();
    const res = await col.deleteOne({ _id });
    if (!res.deletedCount) return json({ error: "Report not found" }, 404);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const pm = await requireRoles("programme_manager");
    const { id } = await ctx.params;
    const _id = oid(id);
    if (!_id) return json({ error: "Invalid id" }, 400);

    const col = await weeklyReportsCol();
    const doc = await col.findOne({ _id });
    if (!doc) return json({ error: "Report not found" }, 404);
    // Single-PM programme: any programme_manager may edit the week's report
    // (the reportId is global per week, so a different PM login must not 403).
    if (doc.status !== "draft" && doc.status !== "returned") {
      return json({ error: "This report is locked (already submitted)." }, 409);
    }

    const body = await readJson<{
      data?: Record<string, unknown>;
      settlements?: SettlementStatus[];
      certification?: Record<string, boolean | string>;
      refresh?: boolean;
    }>(req);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (body.data && typeof body.data === "object") set.data = body.data;
    if (Array.isArray(body.settlements)) set.settlements = body.settlements;
    if (body.certification && typeof body.certification === "object")
      set.certification = body.certification;

    if (body.refresh) {
      const { weekStart, weekEnd } = weekOf(doc.weekStart);
      set.dashboard = await computeDashboard(weekStart, weekEnd);
    }

    await col.updateOne({ _id }, { $set: set });
    const updated = await col.findOne({ _id });
    return json({ report: publicWeeklyReport(updated!, { pmName: pm.name }) });
  } catch (e) {
    return handleError(e);
  }
}
