import { ObjectId } from "mongodb";
import { json, handleError, requireRoles, readJson } from "@/lib/api";
import {
  monthlyReportsCol,
  usersCol,
  type SettlementStatus,
  type UserDoc,
  type MonthlyReportDoc,
} from "@/lib/models";
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

const isOwner = (user: UserDoc, doc: MonthlyReportDoc) =>
  String(doc.programmeManagerId) === String(user._id);

/**
 * The Director reads everything. A Programme Manager reads the CM and MIS
 * reports they review, plus the month's PM report (single-PM programme).
 * Community Mobilisers and the MIS Supervisor read only their own.
 */
function canRead(user: UserDoc, doc: MonthlyReportDoc): boolean {
  if (user.role === "director" || user.role === "programme_manager") return true;
  return isOwner(user, doc);
}

/** Only the author's own role may edit — a reviewer never edits the content. */
function canEdit(user: UserDoc, doc: MonthlyReportDoc): boolean {
  const author = doc.authorRole || "programme_manager";
  if (author !== user.role) return false;
  // Single-PM programme: any programme_manager may edit the month's PM report.
  if (user.role === "programme_manager") return true;
  return isOwner(user, doc);
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("programme_manager", "director", "mis", "cm");
    const { id } = await ctx.params;
    const _id = oid(id);
    if (!_id) return json({ error: "Invalid id" }, 400);

    const col = await monthlyReportsCol();
    const doc = await col.findOne({ _id });
    if (!doc) return json({ error: "Report not found" }, 404);
    if (!canRead(user, doc)) return json({ error: "Forbidden" }, 403);

    const users = await usersCol();
    const pm = await users.findOne({ _id: doc.programmeManagerId });
    return json({ report: publicMonthlyReport(doc, { pmName: pm?.name }) });
  } catch (e) {
    return handleError(e);
  }
}

/** Director-only: delete a monthly report (e.g. duplicates / test data). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRoles("director");
    const { id } = await ctx.params;
    const _id = oid(id);
    if (!_id) return json({ error: "Invalid id" }, 400);
    const col = await monthlyReportsCol();
    const res = await col.deleteOne({ _id });
    if (!res.deletedCount) return json({ error: "Report not found" }, 404);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRoles("programme_manager", "cm", "mis");
    const { id } = await ctx.params;
    const _id = oid(id);
    if (!_id) return json({ error: "Invalid id" }, 400);

    const col = await monthlyReportsCol();
    const doc = await col.findOne({ _id });
    if (!doc) return json({ error: "Report not found" }, 404);
    if (!canEdit(user, doc)) return json({ error: "Forbidden" }, 403);
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
    return json({ report: publicMonthlyReport(updated!, { pmName: user.name }) });
  } catch (e) {
    return handleError(e);
  }
}
