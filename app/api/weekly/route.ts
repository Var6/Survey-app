import { ObjectId } from "mongodb";
import { json, handleError, requireRoles } from "@/lib/api";
import { weeklyReportsCol, usersCol, ensureIndexes, type WeeklyReportDoc } from "@/lib/models";
import { publicWeeklyReport } from "@/lib/serialize";
import { weekOf, computeDashboard } from "@/lib/weekly/dashboard";
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

    const col = await weeklyReportsCol();
    const docs = await col.find(filter).sort({ weekStart: -1 }).toArray();

    const ids = [...new Set(docs.map((d) => String(d.programmeManagerId)))];
    const users = await usersCol();
    const uDocs = ids.length
      ? await users.find({ _id: { $in: ids.map((i) => new ObjectId(i)) } }).toArray()
      : [];
    const nameById = new Map(uDocs.map((u) => [String(u._id), u.name]));

    return json({
      reports: docs.map((d) =>
        publicWeeklyReport(d, { pmName: nameById.get(String(d.programmeManagerId)) })
      ),
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Open (or create) the current week's report for the Programme Manager. */
export async function POST() {
  try {
    const pm = await requireRoles("programme_manager");
    await ensureIndexes();
    const { weekStart, weekEnd, reportId } = weekOf(new Date());
    const col = await weeklyReportsCol();

    const existing = await col.findOne({ reportId });
    if (existing) {
      if (existing.status === "draft" || existing.status === "returned") {
        const dashboard = await computeDashboard(weekStart, weekEnd);
        await col.updateOne(
          { _id: existing._id },
          { $set: { dashboard, updatedAt: new Date() } }
        );
        existing.dashboard = dashboard;
      }
      return json({ report: publicWeeklyReport(existing, { pmName: pm.name }) });
    }

    const dashboard = await computeDashboard(weekStart, weekEnd);
    const now = new Date();
    const doc: WeeklyReportDoc = {
      reportId,
      programmeManagerId: pm._id!,
      pmName: pm.name,
      weekStart,
      weekEnd,
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
      { report: publicWeeklyReport({ ...doc, _id: res.insertedId }, { pmName: pm.name }) },
      201
    );
  } catch (e) {
    return handleError(e);
  }
}
