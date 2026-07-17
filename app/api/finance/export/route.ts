import { ObjectId } from "mongodb";
import { handleError, requireDirector } from "@/lib/api";
import { ledgerCol, expensesCol, projectsCol } from "@/lib/models";
import { buildFinanceWorkbook } from "@/lib/export";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireDirector();
    const params = new URL(req.url).searchParams;

    const filter: Record<string, unknown> = {};
    const pid = params.get("projectId");
    if (pid) {
      try {
        filter.projectId = new ObjectId(pid);
      } catch {
        /* ignore */
      }
    }

    const ledger = await ledgerCol();
    const expenses = await expensesCol();
    const projects = await projectsCol();

    const [entries, exp, projList] = await Promise.all([
      ledger.find(filter).sort({ createdAt: -1 }).limit(5000).toArray(),
      expenses.find(filter).sort({ date: -1 }).limit(5000).toArray(),
      projects.find({}).toArray(),
    ]);

    const nameById = new Map(projList.map((p) => [String(p._id), p.name]));
    const projectName = (id: string) => nameById.get(id) || id;

    const buf = await buildFinanceWorkbook(entries, exp, projectName);
    const date = new Date().toISOString().slice(0, 10);

    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="janman-finance-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return handleError(e);
  }
}
