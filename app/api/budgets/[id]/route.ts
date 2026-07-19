import { ObjectId } from "mongodb";
import { json, handleError, requireFinance, readJson, HttpError } from "@/lib/api";
import { budgetsCol, type BudgetLine } from "@/lib/models";
import { publicBudget, BUDGET_CATEGORIES } from "@/lib/budget";

export const runtime = "nodejs";

function oid(id: string): ObjectId {
  try {
    return new ObjectId(id);
  } catch {
    throw new HttpError(400, "Bad budget id");
  }
}

const VALID_CATS = new Set(BUDGET_CATEGORIES.map((c) => c.key));
const VALID_INFLATION = new Set(["salary", "nil", "other"]);

function sanitizeLines(raw: unknown, numYears: number): BudgetLine[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (l): l is BudgetLine =>
        !!l &&
        typeof l === "object" &&
        VALID_CATS.has((l as BudgetLine).category) &&
        VALID_INFLATION.has((l as BudgetLine).inflation)
    )
    .map((l, i) => ({
      id: String(l.id || i + 1),
      category: l.category,
      description: String(l.description || "").slice(0, 300),
      costCategory: l.costCategory ? String(l.costCategory).slice(0, 40) : undefined,
      inflation: l.inflation,
      unitType: l.unitType ? String(l.unitType).slice(0, 30) : undefined,
      years: Array.from({ length: numYears }, (_, y) => {
        const src = Array.isArray(l.years) ? l.years[y] : undefined;
        return {
          units: Number(src?.units) || 0,
          unitCost: Number(src?.unitCost) || 0,
          allocPct: Math.min(Math.max(Number(src?.allocPct ?? 100), 0), 100),
        };
      }),
      notes: l.notes ? String(l.notes).slice(0, 1000) : undefined,
    }));
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireFinance();
    const { id } = await ctx.params;
    const col = await budgetsCol();
    const doc = await col.findOne({ _id: oid(id) });
    if (!doc) throw new HttpError(404, "Budget not found");
    return json({ budget: publicBudget(doc) });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireFinance();
    const { id } = await ctx.params;
    const _id = oid(id);
    const col = await budgetsCol();
    const doc = await col.findOne({ _id });
    if (!doc) throw new HttpError(404, "Budget not found");

    const body = await readJson<{
      name?: string;
      numYears?: number;
      inflationRates?: { salary?: number; nil?: number; other?: number };
      lines?: unknown;
    }>(req);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name?.trim()) set.name = body.name.trim();
    const numYears = body.numYears
      ? Math.min(Math.max(Number(body.numYears), 1), 5)
      : doc.numYears;
    set.numYears = numYears;
    if (body.inflationRates && typeof body.inflationRates === "object") {
      set.inflationRates = {
        salary: Number(body.inflationRates.salary ?? doc.inflationRates.salary) || 0,
        nil: 0,
        other: Number(body.inflationRates.other ?? doc.inflationRates.other) || 0,
      };
    }
    if (body.lines !== undefined) set.lines = sanitizeLines(body.lines, numYears);

    await col.updateOne({ _id }, { $set: set });
    const updated = await col.findOne({ _id });
    return json({ budget: publicBudget(updated!) });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireFinance();
    const { id } = await ctx.params;
    const col = await budgetsCol();
    const res = await col.deleteOne({ _id: oid(id) });
    if (!res.deletedCount) throw new HttpError(404, "Budget not found");
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
