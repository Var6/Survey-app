import { ObjectId } from "mongodb";
import { json, handleError, requireRoles, readJson } from "@/lib/api";
import { usersCol } from "@/lib/models";
import { listSettlements } from "@/lib/settlements";
import { publicUser } from "@/lib/serialize";

export const runtime = "nodejs";

/**
 * Assign or reassign the communities a Community Mobiliser works in.
 * Deliberately separate from the full user editor: the Programme Manager can
 * move mobilisers between communities without being able to create accounts
 * or change anyone's role.
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

    const body = await readJson<{ communities?: string[] }>(req);
    if (!Array.isArray(body.communities)) {
      return json({ error: "communities must be an array of community codes" }, 400);
    }

    const users = await usersCol();
    const user = await users.findOne({ _id });
    if (!user) return json({ error: "User not found" }, 404);
    if (user.role !== "cm") {
      return json({ error: "Only Community Mobilisers are assigned to communities" }, 400);
    }

    // Accept only codes that actually exist, so a typo cannot orphan a mobiliser.
    const known = new Set((await listSettlements({ includeInactive: true })).map((s) => s.code));
    const communities = [...new Set(body.communities.filter((c) => known.has(c)))];

    await users.updateOne({ _id }, { $set: { communities, updatedAt: new Date() } });
    const updated = await users.findOne({ _id });
    return json({ user: publicUser(updated!) });
  } catch (e) {
    return handleError(e);
  }
}
