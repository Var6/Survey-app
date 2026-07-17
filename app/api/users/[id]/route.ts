import { ObjectId } from "mongodb";
import { json, handleError, requireDirector, readJson } from "@/lib/api";
import { usersCol } from "@/lib/models";
import { hashPassword } from "@/lib/auth";
import { publicUser } from "@/lib/serialize";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireDirector();
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }

    const body = await readJson<{
      name?: string;
      phone?: string;
      mobiliserCode?: string;
      projectId?: string | null;
      communities?: string[];
      active?: boolean;
      newPassword?: string;
    }>(req);

    const users = await usersCol();
    const user = await users.findOne({ _id, role: "cm" });
    if (!user) return json({ error: "Mobiliser not found" }, 404);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.name === "string" && body.name.trim()) set.name = body.name.trim();
    if (typeof body.phone === "string") set.phone = body.phone.trim();
    if (typeof body.mobiliserCode === "string") set.mobiliserCode = body.mobiliserCode.trim();
    if (Array.isArray(body.communities)) set.communities = body.communities;
    if (typeof body.active === "boolean") set.active = body.active;
    if (body.projectId === null) {
      set.projectId = undefined;
    } else if (typeof body.projectId === "string" && body.projectId) {
      try {
        set.projectId = new ObjectId(body.projectId);
      } catch {
        return json({ error: "Invalid projectId" }, 400);
      }
    }
    if (body.newPassword) {
      if (body.newPassword.length < 6) {
        return json({ error: "Password must be at least 6 characters" }, 400);
      }
      set.passwordHash = await hashPassword(body.newPassword);
    }

    await users.updateOne({ _id }, { $set: set });
    const updated = await users.findOne({ _id });
    return json({ user: publicUser(updated!) });
  } catch (e) {
    return handleError(e);
  }
}
