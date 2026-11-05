import { ObjectId } from "mongodb";
import { json, handleError, requireFinance, readJson } from "@/lib/api";
import { requisitionsCol } from "@/lib/models";
import { publicRequisition } from "@/lib/serialize";
import { notifyUsers } from "@/lib/notifications";
import { formatMoney } from "@/lib/money";

/** Delete a requisition. Paid ones are immutable (money already moved). */
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
    const reqs = await requisitionsCol();
    const doc = await reqs.findOne({ _id });
    if (!doc) return json({ error: "Requisition not found" }, 404);
    if (doc.status === "paid") {
      return json({ error: "Paid requisitions cannot be deleted (ledger already debited)" }, 409);
    }
    await reqs.deleteOne({ _id });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const reviewer = await requireFinance();
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }

    const { action, note } = await readJson<{
      action?: "approve" | "reject";
      note?: string;
    }>(req);
    if (action !== "approve" && action !== "reject") {
      return json({ error: "action must be 'approve' or 'reject'" }, 400);
    }
    const reason = note?.trim() || "";
    if (action === "reject" && !reason) {
      return json({ error: "Tell the requester why it was rejected" }, 400);
    }

    const reqs = await requisitionsCol();
    const now = new Date();
    // Only a pending request can be decided, and only once: the status check
    // is part of the update, so two people pressing Approve cannot both win.
    const res = await reqs.findOneAndUpdate(
      { _id, status: "pending" },
      {
        $set: {
          status: action === "approve" ? "approved" : "rejected",
          reviewedBy: reviewer._id,
          reviewedAt: now,
          reviewNote: reason || undefined,
          updatedAt: now,
        },
      },
      { returnDocument: "after" }
    );
    if (!res) {
      const doc = await reqs.findOne({ _id });
      if (!doc) return json({ error: "Requisition not found" }, 404);
      return json({ error: `Cannot ${action} a requisition that is already ${doc.status}` }, 409);
    }

    await notifyUsers(
      [res.mobiliserId],
      {
        category: "requisition_decided",
        title: action === "approve" ? "Your request was approved" : "Your request was rejected",
        body:
          action === "approve"
            ? `${formatMoney(res.amount, res.currency)} for “${res.purpose}” is approved and will be paid.`
            : `${formatMoney(res.amount, res.currency)} for “${res.purpose}” was rejected: ${reason}`,
        relatedType: "requisition",
        relatedId: String(res._id),
        dedupeKey: `requisition:${res._id}:${action}`,
      },
      { excludeUserId: reviewer._id }
    );
    return json({ requisition: publicRequisition(res) });
  } catch (e) {
    return handleError(e);
  }
}
