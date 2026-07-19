import { ObjectId } from "mongodb";
import { json, handleError, requireFinance, readJson } from "@/lib/api";
import { expensesCol } from "@/lib/models";
import { publicExpense } from "@/lib/serialize";

export const runtime = "nodejs";

function oid(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireFinance();
    const { id } = await ctx.params;
    const _id = oid(id);
    if (!_id) return json({ error: "Invalid id" }, 400);

    const body = await readJson<{
      category?: string;
      amount?: number;
      description?: string;
      paidTo?: string;
      date?: string;
    }>(req);

    const expenses = await expensesCol();
    const doc = await expenses.findOne({ _id });
    if (!doc) return json({ error: "Expense not found" }, 404);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.category === "string" && body.category.trim())
      set.category = body.category.trim();
    if (body.amount !== undefined) {
      const amount = Number(body.amount);
      if (!Number.isFinite(amount) || amount <= 0)
        return json({ error: "Amount must be positive" }, 400);
      set.amount = amount;
    }
    if (typeof body.description === "string") set.description = body.description.trim();
    if (typeof body.paidTo === "string") set.paidTo = body.paidTo.trim();
    if (typeof body.date === "string" && body.date) set.date = new Date(body.date);

    await expenses.updateOne({ _id }, { $set: set });
    const updated = await expenses.findOne({ _id });
    return json({ expense: publicExpense(updated!) });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireFinance();
    const { id } = await ctx.params;
    const _id = oid(id);
    if (!_id) return json({ error: "Invalid id" }, 400);
    const expenses = await expensesCol();
    const res = await expenses.deleteOne({ _id });
    if (!res.deletedCount) return json({ error: "Expense not found" }, 404);
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
