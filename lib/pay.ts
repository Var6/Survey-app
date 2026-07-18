import { ObjectId } from "mongodb";
import { paymentsCol, projectsCol, ledgerCol, type UserDoc } from "./models";

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Settle a pending payment (salary/benefit/bonus) to a CM:
 * checks the project balance, debits the project, writes a ledger entry,
 * and marks the payment paid. Returns the outcome.
 */
export async function settlePayment(
  paymentId: ObjectId,
  director: UserDoc
): Promise<{ ok: boolean; error?: string; balance?: number }> {
  const payments = await paymentsCol();
  const p = await payments.findOne({ _id: paymentId });
  if (!p) return { ok: false, error: "Payment not found" };
  if (p.status === "paid") return { ok: false, error: "Already paid" };

  const projects = await projectsCol();
  const project = await projects.findOne({ _id: p.projectId });
  if (!project) return { ok: false, error: "Project not found" };

  const balance = (project.totalFunds || 0) - (project.spentFunds || 0);
  if (p.amount > balance) {
    return { ok: false, error: `Insufficient project balance. Available: ${balance}` };
  }

  const now = new Date();
  const newSpent = (project.spentFunds || 0) + p.amount;

  await projects.updateOne(
    { _id: project._id },
    { $inc: { spentFunds: p.amount }, $set: { updatedAt: now } }
  );

  const ledger = await ledgerCol();
  await ledger.insertOne({
    projectId: project._id!,
    type: "debit",
    amount: p.amount,
    refType: "payment",
    refId: p._id,
    balanceAfter: (project.totalFunds || 0) - newSpent,
    note: `${cap(p.type)} to ${p.mobiliserName || "CM"}${p.period ? ` (${p.period})` : ""}`,
    createdBy: director._id,
    createdAt: now,
  });

  await payments.updateOne(
    { _id: p._id },
    { $set: { status: "paid", paidAt: now, updatedAt: now } }
  );

  return { ok: true, balance: (project.totalFunds || 0) - newSpent };
}
