import { ObjectId } from "mongodb";
import { json, handleError, requireRoles } from "@/lib/api";
import { monthlyReportsCol, usersCol, ensureIndexes, type MonthlyReportDoc } from "@/lib/models";
import { publicMonthlyReport } from "@/lib/serialize";
import { monthOf, computeMonthlyDashboard } from "@/lib/monthly/dashboard";
import { variantForRole, monthlyReportId } from "@/lib/monthly/variants";
import { buildMonthlyFilter } from "@/lib/monthly/query";
import { SETTLEMENTS } from "@/lib/questionnaire/settlements";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireRoles("programme_manager", "director", "mis", "cm");
    const params = new URL(req.url).searchParams;

    // Same rule the Excel export and the PDF print view use.
    const filter = buildMonthlyFilter(user, params);

    const col = await monthlyReportsCol();
    const docs = await col.find(filter).sort({ monthStart: -1 }).toArray();

    const ids = [...new Set(docs.map((d) => String(d.programmeManagerId)))];
    const users = await usersCol();
    const uDocs = ids.length
      ? await users.find({ _id: { $in: ids.map((i) => new ObjectId(i)) } }).toArray()
      : [];
    const nameById = new Map(uDocs.map((u) => [String(u._id), u.name]));

    return json({
      reports: docs.map((d) =>
        publicMonthlyReport(d, { pmName: nameById.get(String(d.programmeManagerId)) })
      ),
    });
  } catch (e) {
    return handleError(e);
  }
}

/**
 * Open (or create) the current month's report for whoever is calling —
 * Programme Manager, Community Mobiliser or MIS Supervisor. Each author gets
 * their own document for the month.
 */
export async function POST() {
  try {
    const user = await requireRoles("programme_manager", "cm", "mis");
    const variant = variantForRole(user.role);
    if (!variant) return json({ error: "No monthly report for this role" }, 403);
    await ensureIndexes();
    const { monthStart, monthEnd, year, month } = monthOf(new Date());
    // CM reports are per-mobiliser, so their id carries the mobiliser code.
    const suffix =
      variant.key === "cm" ? user.mobiliserCode || String(user._id).slice(-4) : undefined;
    const reportId = monthlyReportId(variant, year, month, suffix);
    const col = await monthlyReportsCol();

    const existing = await col.findOne({ reportId });
    if (existing) {
      if (existing.status === "draft" || existing.status === "returned") {
        const dashboard = await computeMonthlyDashboard(monthStart, monthEnd);
        await col.updateOne(
          { _id: existing._id },
          { $set: { dashboard, updatedAt: new Date() } }
        );
        existing.dashboard = dashboard;
      }
      return json({ report: publicMonthlyReport(existing, { pmName: user.name }) });
    }

    const dashboard = await computeMonthlyDashboard(monthStart, monthEnd);
    const now = new Date();
    const doc: MonthlyReportDoc = {
      reportId,
      programmeManagerId: user._id!,
      authorRole: user.role,
      pmName: user.name,
      monthStart,
      monthEnd,
      status: "draft",
      dashboard,
      settlements: variant.hasSettlementControl
        ? SETTLEMENTS.map((s) => ({ code: s.code, status: "green" as const }))
        : [],
      data: {},
      certification: {},
      createdAt: now,
      updatedAt: now,
    };
    const res = await col.insertOne(doc);
    return json(
      { report: publicMonthlyReport({ ...doc, _id: res.insertedId }, { pmName: user.name }) },
      201
    );
  } catch (e) {
    return handleError(e);
  }
}
