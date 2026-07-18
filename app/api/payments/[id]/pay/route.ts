import { ObjectId } from "mongodb";
import { json, handleError, requireFinance } from "@/lib/api";
import { paymentsCol } from "@/lib/models";
import { publicPayment } from "@/lib/serialize";
import { settlePayment } from "@/lib/pay";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const director = await requireFinance();
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }

    const result = await settlePayment(_id, director);
    if (!result.ok) return json({ error: result.error }, 400);

    const payments = await paymentsCol();
    const updated = await payments.findOne({ _id });
    return json({ payment: publicPayment(updated!), projectBalance: result.balance });
  } catch (e) {
    return handleError(e);
  }
}
