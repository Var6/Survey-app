import { ObjectId } from "mongodb";
import { handleError, requireRoles } from "@/lib/api";
import { reportsCol, usersCol } from "@/lib/models";
import { buildDailyReportsWorkbook } from "@/lib/export";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireRoles("director", "mis", "programme_manager");
    const params = new URL(req.url).searchParams;
    const role = params.get("role") || "cm";

    const filter: Record<string, unknown> = { period: "daily" };
    if (role === "pm") filter.authorRole = "programme_manager";
    else filter.$or = [{ authorRole: "cm" }, { authorRole: { $exists: false } }];

    const reports = await reportsCol();
    const docs = await reports.find(filter).sort({ periodDate: -1 }).limit(5000).toArray();

    const ids = [...new Set(docs.map((d) => String(d.mobiliserId)))];
    const users = await usersCol();
    const uDocs = ids.length
      ? await users.find({ _id: { $in: ids.map((i) => new ObjectId(i)) } }).toArray()
      : [];
    const nameById = new Map(uDocs.map((u) => [String(u._id), u.name]));

    const buf = await buildDailyReportsWorkbook(
      docs.map((report) => ({ report, authorName: nameById.get(String(report.mobiliserId)) }))
    );
    const date = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="janman-daily-${role}-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
