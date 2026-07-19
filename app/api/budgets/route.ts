import { json, handleError, requireFinance, readJson } from "@/lib/api";
import { budgetsCol, type BudgetDoc } from "@/lib/models";
import { publicBudget, DEFAULT_INFLATION } from "@/lib/budget";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireFinance();
    const col = await budgetsCol();
    const docs = await col.find({}).sort({ updatedAt: -1 }).toArray();
    return json({ budgets: docs.map(publicBudget) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireFinance();
    const body = await readJson<{ name?: string; numYears?: number }>(req);
    const name = body.name?.trim();
    if (!name) return json({ error: "Budget name is required" }, 400);
    const numYears = Math.min(Math.max(Number(body.numYears) || 2, 1), 5);

    const now = new Date();
    const doc: BudgetDoc = {
      name,
      currency: "INR",
      numYears,
      inflationRates: { ...DEFAULT_INFLATION },
      lines: [],
      createdBy: user._id,
      createdByName: user.name,
      createdAt: now,
      updatedAt: now,
    };
    const col = await budgetsCol();
    const res = await col.insertOne(doc);
    return json({ budget: publicBudget({ ...doc, _id: res.insertedId }) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
