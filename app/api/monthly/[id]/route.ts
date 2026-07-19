import { ObjectId } from "mongodb";
import { json, handleError, requireRoles, readJson } from "@/lib/api";
import { monthlyReportsCol, usersCol, type SettlementStatus } from "@/lib/models";
import { publicMonthlyReport } from "@/lib/serialize";
import { monthOf, computeMonthlyDashboard } from "@/lib/monthly/dashboard";

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

    const col = await monthlyReportsCol();
    const doc = await col.findOne({ _id });
    if (!doc) return json({ error: "Report not found" }, 404);
    if (user.role === "programme_manager" && String(doc.programmeManagerId) !== String(user._id)) {
      return json({ error: "Forbidden" }, 403);
    }

    const users = await usersCol();
    const pm = await users.findOne({ _id: doc.programmeManagerId });
    return json({ report: publicMonthlyReport(doc, { pmName: pm?.name }) });
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

    const col = await monthlyReportsCol();
    const doc = await col.findOne({ _id });
    if (!doc) return json({ error: "Report not found" }, 404);
    if (String(doc.programmeManagerId) !== String(pm._id)) {
      return json({ error: "Forbidden" }, 403);
    }
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
      const { monthStart, monthEnd } = monthOf(doc.monthStart);
      set.dashboard = await computeMonthlyDashboard(monthStart, monthEnd);
    }

    await col.updateOne({ _id }, { $set: set });
    const updated = await col.findOne({ _id });
    return json({ report: publicMonthlyReport(updated!, { pmName: pm.name }) });
  } catch (e) {
    return handleError(e);
  }
}
