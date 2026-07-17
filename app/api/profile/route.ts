import { json, handleError, requireUser, readJson } from "@/lib/api";
import { usersCol } from "@/lib/models";
import { publicUser } from "@/lib/serialize";

export async function GET() {
  try {
    const user = await requireUser();
    return json({ user: publicUser(user) });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ name?: string; phone?: string }>(req);

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.name === "string" && body.name.trim()) {
      set.name = body.name.trim();
    }
    if (typeof body.phone === "string") {
      set.phone = body.phone.trim();
    }

    const users = await usersCol();
    await users.updateOne({ _id: user._id }, { $set: set });
    const updated = await users.findOne({ _id: user._id });
    return json({ user: publicUser(updated!) });
  } catch (e) {
    return handleError(e);
  }
}
