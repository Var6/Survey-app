import { ObjectId } from "mongodb";
import { paymentsCol, projectsCol, ledgerCol, type UserDoc } from "./models";

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Settle a pending payment (salary/benefit/bonus) to a CM. The payment is
 * claimed first (pending → paid) so it can only be paid once, the project is
 * debited only if its balance covers it (checked in the same update), a ledger
 * entry is written, and everything is put back if a later step fails.
 */
export async function settlePayment(
  paymentId: ObjectId,
  director: UserDoc
): Promise<{ ok: boolean; error?: string; balance?: number }> {
  const payments = await paymentsCol();
  const projects = await projectsCol();
  const now = new Date();

  const p = await payments.findOneAndUpdate(
    { _id: paymentId, status: "pending" },
    { $set: { status: "paid", paidAt: now, updatedAt: now } },
    { returnDocument: "after" }
  );
  if (!p) {
    const existing = await payments.findOne({ _id: paymentId });
    return { ok: false, error: existing ? "Already paid" : "Payment not found" };
  }
  const putBack = () =>
    payments.updateOne({ _id: p._id, status: "paid" }, { $set: { status: "pending", updatedAt: new Date() }, $unset: { paidAt: "" } });

  const project = await projects.findOneAndUpdate(
    {
      _id: p.projectId,
      $expr: { $lte: [{ $add: [{ $ifNull: ["$spentFunds", 0] }, p.amount] }, { $ifNull: ["$totalFunds", 0] }] },
    },
    { $inc: { spentFunds: p.amount }, $set: { updatedAt: now } },
    { returnDocument: "after" }
  );
  if (!project) {
    await putBack();
    const current = await projects.findOne({ _id: p.projectId });
    if (!current) return { ok: false, error: "Project not found" };
    const balance = (current.totalFunds || 0) - (current.spentFunds || 0);
    return { ok: false, error: `Insufficient project balance. Available: ${balance}` };
  }

  try {
    const ledger = await ledgerCol();
    await ledger.insertOne({
      projectId: project._id!,
      type: "debit",
      amount: p.amount,
      refType: "payment",
      refId: p._id,
      balanceAfter: (project.totalFunds || 0) - (project.spentFunds || 0),
      note: `${cap(p.type)} to ${p.mobiliserName || "CM"}${p.period ? ` (${p.period})` : ""}`,
      createdBy: director._id,
      createdAt: now,
    });
  } catch (e) {
    await projects.updateOne({ _id: project._id }, { $inc: { spentFunds: -p.amount } });
    await putBack();
    throw e;
  }

  return { ok: true, balance: (project.totalFunds || 0) - (project.spentFunds || 0) };
}
