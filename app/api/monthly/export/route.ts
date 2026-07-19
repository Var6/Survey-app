import { handleError, requireRoles } from "@/lib/api";
import { monthlyReportsCol } from "@/lib/models";
import { buildMonthlyWorkbook } from "@/lib/export";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireRoles("director", "mis", "programme_manager");
    const col = await monthlyReportsCol();
    const docs = await col.find({}).sort({ monthStart: -1 }).limit(1000).toArray();
    const buf = await buildMonthlyWorkbook(docs);
    const date = new Date().toISOString().slice(0, 10);
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="janman-monthly-reports-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
