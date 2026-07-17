import { ObjectId } from "mongodb";
import { json, handleError, requireDirector, readJson } from "@/lib/api";
import { requisitionsCol } from "@/lib/models";
import { publicRequisition } from "@/lib/serialize";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const director = await requireDirector();
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

    const reqs = await requisitionsCol();
    const doc = await reqs.findOne({ _id });
    if (!doc) return json({ error: "Requisition not found" }, 404);
    if (doc.status !== "pending") {
      return json(
        { error: `Cannot ${action} a requisition that is already ${doc.status}` },
        409
      );
    }

    const now = new Date();
    await reqs.updateOne(
      { _id },
      {
        $set: {
          status: action === "approve" ? "approved" : "rejected",
          reviewedBy: director._id,
          reviewedAt: now,
          reviewNote: note?.trim() || undefined,
          updatedAt: now,
        },
      }
    );
    const updated = await reqs.findOne({ _id });
    return json({ requisition: publicRequisition(updated!) });
  } catch (e) {
    return handleError(e);
  }
}
