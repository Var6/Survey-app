import { json, handleError, requireFinance, readJson } from "@/lib/api";
import {
  projectsCol,
  ledgerCol,
  ensureIndexes,
  type ProjectDoc,
} from "@/lib/models";
import { publicProject } from "@/lib/serialize";

export async function GET() {
  try {
    await requireFinance();
    const projects = await projectsCol();
    const list = await projects.find({}).sort({ createdAt: -1 }).toArray();
    return json({ projects: list.map(publicProject) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const director = await requireFinance();
    await ensureIndexes();
    const body = await readJson<{
      name?: string;
      code?: string;
      funder?: string;
      description?: string;
      currency?: string;
      totalFunds?: number;
      startDate?: string;
      endDate?: string;
    }>(req);

    if (!body.name || !body.name.trim()) {
      return json({ error: "Project name is required" }, 400);
    }
    const totalFunds = Number(body.totalFunds) || 0;
    if (totalFunds < 0) return json({ error: "Funds cannot be negative" }, 400);

    const now = new Date();
    const doc: ProjectDoc = {
      name: body.name.trim(),
      code: body.code?.trim() || undefined,
      funder: body.funder?.trim() || undefined,
      description: body.description?.trim() || undefined,
      currency: body.currency?.trim() || "INR",
      totalFunds,
      spentFunds: 0,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      active: true,
      createdBy: director._id,
      createdAt: now,
      updatedAt: now,
    };

    const projects = await projectsCol();
    const res = await projects.insertOne(doc);

    if (totalFunds > 0) {
      const ledger = await ledgerCol();
      await ledger.insertOne({
        projectId: res.insertedId,
        type: "allocation",
        amount: totalFunds,
        balanceAfter: totalFunds,
        note: "Initial allocation",
        createdBy: director._id,
        createdAt: now,
      });
    }

    return json({ project: publicProject({ ...doc, _id: res.insertedId }) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
