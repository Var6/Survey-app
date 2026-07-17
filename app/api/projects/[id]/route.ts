import { ObjectId } from "mongodb";
import { json, handleError, requireDirector, readJson } from "@/lib/api";
import { projectsCol, ledgerCol } from "@/lib/models";
import { publicProject } from "@/lib/serialize";

function oid(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireDirector();
    const { id } = await ctx.params;
    const _id = oid(id);
    if (!_id) return json({ error: "Invalid id" }, 400);

    const projects = await projectsCol();
    const project = await projects.findOne({ _id });
    if (!project) return json({ error: "Project not found" }, 404);
    return json({ project: publicProject(project) });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const director = await requireDirector();
    const { id } = await ctx.params;
    const _id = oid(id);
    if (!_id) return json({ error: "Invalid id" }, 400);

    const body = await readJson<{
      name?: string;
      funder?: string;
      description?: string;
      active?: boolean;
      addFunds?: number;
    }>(req);

    const projects = await projectsCol();
    const project = await projects.findOne({ _id });
    if (!project) return json({ error: "Project not found" }, 404);

    const now = new Date();
    const set: Record<string, unknown> = { updatedAt: now };
    if (typeof body.name === "string" && body.name.trim()) set.name = body.name.trim();
    if (typeof body.funder === "string") set.funder = body.funder.trim();
    if (typeof body.description === "string") set.description = body.description.trim();
    if (typeof body.active === "boolean") set.active = body.active;

    const addFunds = Number(body.addFunds) || 0;
    let newTotal = project.totalFunds || 0;
    if (addFunds > 0) {
      newTotal += addFunds;
      set.totalFunds = newTotal;
    }

    await projects.updateOne({ _id }, { $set: set });

    if (addFunds > 0) {
      const ledger = await ledgerCol();
      await ledger.insertOne({
        projectId: _id,
        type: "allocation",
        amount: addFunds,
        balanceAfter: newTotal - (project.spentFunds || 0),
        note: "Added funds",
        createdBy: director._id,
        createdAt: now,
      });
    }

    const updated = await projects.findOne({ _id });
    return json({ project: publicProject(updated!) });
  } catch (e) {
    return handleError(e);
  }
}
