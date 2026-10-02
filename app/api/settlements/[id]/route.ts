import { ObjectId } from "mongodb";
import { json, handleError, requireRoles, readJson } from "@/lib/api";
import { settlementsCol, surveysCol } from "@/lib/models";

export const runtime = "nodejs";

/**
 * Rename a community, or retire/restore it.
 * The code and household-ID prefix are never changed: existing surveys refer
 * to the code, and household IDs already issued carry the prefix.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRoles("director", "programme_manager", "mis");
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }

    const body = await readJson<{ label?: string; active?: boolean; order?: number }>(req);
    const col = await settlementsCol();
    const doc = await col.findOne({ _id });
    if (!doc) return json({ error: "Community not found" }, 404);

    const set: Record<string, unknown> = { updatedAt: new Date() };

    if (typeof body.label === "string") {
      const label = body.label.trim();
      if (!label) return json({ error: "Community name is required" }, 400);
      const clash = await col.findOne({
        _id: { $ne: _id },
        label: { $regex: `^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
      });
      if (clash) return json({ error: "Another community already uses this name" }, 409);
      set.label = label;
    }

    if (typeof body.active === "boolean") {
      // Retiring only hides it from new surveys; existing data is untouched.
      set.active = body.active;
    }
    if (typeof body.order === "number" && Number.isFinite(body.order)) {
      set.order = Math.trunc(body.order);
    }

    await col.updateOne({ _id }, { $set: set });
    const updated = await col.findOne({ _id });
    const surveys = await surveysCol();
    return json({
      settlement: {
        id: String(updated!._id),
        code: updated!.code,
        label: updated!.label,
        hhPrefix: updated!.hhPrefix,
        active: updated!.active,
        order: updated!.order,
        surveyCount: await surveys.countDocuments({ settlementCode: updated!.code }),
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

/** Delete a community — only while nothing has been surveyed in it. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRoles("director", "programme_manager", "mis");
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }
    const col = await settlementsCol();
    const doc = await col.findOne({ _id });
    if (!doc) return json({ error: "Community not found" }, 404);

    const surveys = await surveysCol();
    const used = await surveys.countDocuments({ settlementCode: doc.code });
    if (used > 0) {
      return json(
        {
          error: `${doc.label} has ${used} survey${used === 1 ? "" : "s"}. Retire it instead of deleting, so the existing data keeps its community name.`,
        },
        409
      );
    }
    await col.deleteOne({ _id });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
