import { ObjectId } from "mongodb";
import { json, handleError, requireDirector } from "@/lib/api";
import { requisitionsCol, projectsCol, ledgerCol } from "@/lib/models";
import { publicRequisition } from "@/lib/serialize";

/**
 * Mark an approved requisition as paid:
 *  - checks the project has enough balance,
 *  - debits the project (increments spentFunds),
 *  - writes a ledger entry,
 *  - flips the requisition to `paid`.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const director = await requireDirector();
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }

    const body = (await req.json().catch(() => ({}))) as { paymentRef?: string };

    const reqs = await requisitionsCol();
    const doc = await reqs.findOne({ _id });
    if (!doc) return json({ error: "Requisition not found" }, 404);
    if (doc.status !== "approved") {
      return json(
        { error: "Requisition must be approved before it can be paid" },
        409
      );
    }

    const projects = await projectsCol();
    const project = await projects.findOne({ _id: doc.projectId });
    if (!project) return json({ error: "Project not found" }, 404);

    const balance = (project.totalFunds || 0) - (project.spentFunds || 0);
    if (doc.amount > balance) {
      return json(
        { error: `Insufficient project balance. Available: ${balance}` },
        400
      );
    }

    const now = new Date();
    const newSpent = (project.spentFunds || 0) + doc.amount;

    await projects.updateOne(
      { _id: project._id },
      { $inc: { spentFunds: doc.amount }, $set: { updatedAt: now } }
    );

    const ledger = await ledgerCol();
    await ledger.insertOne({
      projectId: project._id!,
      type: "debit",
      amount: doc.amount,
      refType: "requisition",
      refId: _id,
      balanceAfter: (project.totalFunds || 0) - newSpent,
      note: `Reimbursement: ${doc.purpose}`,
      createdBy: director._id,
      createdAt: now,
    });

    await reqs.updateOne(
      { _id },
      {
        $set: {
          status: "paid",
          paidAt: now,
          paymentRef: body.paymentRef?.trim() || undefined,
          updatedAt: now,
        },
      }
    );

    const updated = await reqs.findOne({ _id });
    return json({
      requisition: publicRequisition(updated!),
      projectBalance: (project.totalFunds || 0) - newSpent,
    });
  } catch (e) {
    return handleError(e);
  }
}
