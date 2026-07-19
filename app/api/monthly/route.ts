import { ObjectId } from "mongodb";
import { json, handleError, requireRoles } from "@/lib/api";
import { monthlyReportsCol, usersCol, ensureIndexes, type MonthlyReportDoc } from "@/lib/models";
import { publicMonthlyReport } from "@/lib/serialize";
import { monthOf, computeMonthlyDashboard } from "@/lib/monthly/dashboard";
import { SETTLEMENTS } from "@/lib/questionnaire/settlements";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const user = await requireRoles("programme_manager", "director", "mis");
    const params = new URL(req.url).searchParams;

    const filter: Record<string, unknown> = {};
    if (user.role === "programme_manager") filter.programmeManagerId = user._id;
    const status = params.get("status");
    if (status) filter.status = status;

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

/** Open (or create) the current month's report for the Programme Manager. */
export async function POST() {
  try {
    const pm = await requireRoles("programme_manager");
    await ensureIndexes();
    const { monthStart, monthEnd, reportId } = monthOf(new Date());
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
      return json({ report: publicMonthlyReport(existing, { pmName: pm.name }) });
    }

    const dashboard = await computeMonthlyDashboard(monthStart, monthEnd);
    const now = new Date();
    const doc: MonthlyReportDoc = {
      reportId,
      programmeManagerId: pm._id!,
      pmName: pm.name,
      monthStart,
      monthEnd,
      status: "draft",
      dashboard,
      settlements: SETTLEMENTS.map((s) => ({ code: s.code, status: "green" as const })),
      data: {},
      certification: {},
      createdAt: now,
      updatedAt: now,
    };
    const res = await col.insertOne(doc);
    return json(
      { report: publicMonthlyReport({ ...doc, _id: res.insertedId }, { pmName: pm.name }) },
      201
    );
  } catch (e) {
    return handleError(e);
  }
}
