import { readJson, json, handleError } from "@/lib/api";
import { usersCol, ensureIndexes } from "@/lib/models";
import { verifyPassword } from "@/lib/auth";
import { createSessionToken, setSessionCookie } from "@/lib/session";
import { publicUser } from "@/lib/serialize";

export const runtime = "nodejs";
/** Keep the ceiling above a cold Atlas connect so a slow login still returns
 *  JSON, instead of the platform killing it and serving an HTML error page. */
export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    // Index creation (~28 round-trips) must never sit in front of a login;
    // it runs in the background and other routes ensure it too.
    void ensureIndexes().catch(() => {});
    const { email, password } = await readJson<{
      email?: string;
      password?: string;
    }>(req);

    if (!email || !password) {
      return json({ error: "Email and password are required" }, 400);
    }

    const users = await usersCol();
    const user = await users.findOne({ email: email.toLowerCase().trim() });

    // Same response whether user is missing or password is wrong.
    if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
      return json({ error: "Invalid email or password" }, 401);
    }

    const token = await createSessionToken({
      sub: String(user._id),
      role: user.role,
      name: user.name,
      email: user.email,
      projectId: user.projectId ? String(user.projectId) : undefined,
    });
    await setSessionCookie(token);

    return json({ user: publicUser(user) });
  } catch (e) {
    return handleError(e);
  }
}
