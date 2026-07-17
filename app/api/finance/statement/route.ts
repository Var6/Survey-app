import { ObjectId } from "mongodb";
import { json, handleError, requireDirector } from "@/lib/api";
import { ledgerCol, projectsCol } from "@/lib/models";
import { publicLedgerEntry, publicProject } from "@/lib/serialize";

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
    const entries = await ledger
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(1000)
      .toArray();

    const projects = await projectsCol();
    const projList = await projects.find({}).sort({ createdAt: -1 }).toArray();

    return json({
      entries: entries.map(publicLedgerEntry),
      projects: projList.map(publicProject),
    });
  } catch (e) {
    return handleError(e);
  }
}
