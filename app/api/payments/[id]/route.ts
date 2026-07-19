import { ObjectId } from "mongodb";
import { json, handleError, requireFinance } from "@/lib/api";
import { paymentsCol } from "@/lib/models";

export const runtime = "nodejs";

/** Delete a payment. Paid payments are immutable (they moved money). */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireFinance();
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }
    const payments = await paymentsCol();
    const doc = await payments.findOne({ _id });
    if (!doc) return json({ error: "Payment not found" }, 404);
    if (doc.status === "paid") {
      return json({ error: "Paid payments cannot be deleted (ledger already debited)" }, 409);
    }
    await payments.deleteOne({ _id });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
