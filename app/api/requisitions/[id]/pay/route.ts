import { ObjectId } from "mongodb";
import { json, handleError, requireFinance } from "@/lib/api";
import { requisitionsCol, projectsCol, ledgerCol } from "@/lib/models";
import { publicRequisition } from "@/lib/serialize";
import { notifyUsers } from "@/lib/notifications";
import { formatMoney } from "@/lib/money";

/**
 * Mark an approved requisition as paid:
 *  - claims the request first (approved → paid), so a double click or two
 *    people paying at once can only ever pay it once,
 *  - debits the project only if the balance covers it (checked in the same
 *    database update, not in a separate read),
 *  - writes a ledger entry,
 *  - and puts everything back if any step after the claim fails.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const payer = await requireFinance();
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }

    const body = (await req.json().catch(() => ({}))) as { paymentRef?: string };
    const paymentRef = body.paymentRef?.trim() || undefined;

    const reqs = await requisitionsCol();
    const projects = await projectsCol();
    const now = new Date();

    const claimed = await reqs.findOneAndUpdate(
      { _id, status: "approved" },
      { $set: { status: "paid", paidAt: now, paymentRef, updatedAt: now } },
      { returnDocument: "after" }
    );
    if (!claimed) {
      const doc = await reqs.findOne({ _id });
      if (!doc) return json({ error: "Requisition not found" }, 404);
      return json({ error: "Requisition must be approved before it can be paid" }, 409);
    }

    const putBack = () =>
      reqs.updateOne(
        { _id, status: "paid" },
        { $set: { status: "approved", updatedAt: new Date() }, $unset: { paidAt: "", paymentRef: "" } }
      );

    const project = await projects.findOneAndUpdate(
      {
        _id: claimed.projectId,
        $expr: {
          $lte: [{ $add: [{ $ifNull: ["$spentFunds", 0] }, claimed.amount] }, { $ifNull: ["$totalFunds", 0] }],
        },
      },
      { $inc: { spentFunds: claimed.amount }, $set: { updatedAt: now } },
      { returnDocument: "after" }
    );
    if (!project) {
      await putBack();
      const p = await projects.findOne({ _id: claimed.projectId });
      if (!p) return json({ error: "Project not found" }, 404);
      const balance = (p.totalFunds || 0) - (p.spentFunds || 0);
      return json(
        { error: `Insufficient project balance. Available: ${formatMoney(balance, p.currency)}` },
        400
      );
    }

    try {
      const ledger = await ledgerCol();
      await ledger.insertOne({
        projectId: project._id!,
        type: "debit",
        amount: claimed.amount,
        refType: "requisition",
        refId: _id,
        balanceAfter: (project.totalFunds || 0) - (project.spentFunds || 0),
        note: `${claimed.kind === "advance" ? "Advance" : "Reimbursement"}: ${claimed.purpose}`,
        createdBy: payer._id,
        createdAt: now,
      });
    } catch (e) {
      await projects.updateOne({ _id: project._id }, { $inc: { spentFunds: -claimed.amount } });
      await putBack();
      throw e;
    }

    await notifyUsers(
      [claimed.mobiliserId],
      {
        category: "requisition_paid",
        title: "Your request was paid",
        body: `${formatMoney(claimed.amount, claimed.currency)} for “${claimed.purpose}” has been paid${
          paymentRef ? ` (ref ${paymentRef})` : ""
        }.`,
        relatedType: "requisition",
        relatedId: String(_id),
        dedupeKey: `requisition:${_id}:paid`,
      },
      { excludeUserId: payer._id }
    );

    return json({
      requisition: publicRequisition(claimed),
      projectBalance: (project.totalFunds || 0) - (project.spentFunds || 0),
    });
  } catch (e) {
    return handleError(e);
  }
}
