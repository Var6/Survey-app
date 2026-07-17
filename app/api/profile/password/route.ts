import { json, handleError, requireUser, readJson } from "@/lib/api";
import { usersCol } from "@/lib/models";
import { hashPassword, verifyPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { currentPassword, newPassword } = await readJson<{
      currentPassword?: string;
      newPassword?: string;
    }>(req);

    if (!currentPassword || !newPassword) {
      return json({ error: "Current and new password are required" }, 400);
    }
    if (newPassword.length < 6) {
      return json({ error: "New password must be at least 6 characters" }, 400);
    }
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      return json({ error: "Current password is incorrect" }, 400);
    }

    const users = await usersCol();
    await users.updateOne(
      { _id: user._id },
      { $set: { passwordHash: await hashPassword(newPassword), updatedAt: new Date() } }
    );
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
