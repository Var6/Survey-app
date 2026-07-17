import { json, handleError } from "@/lib/api";
import { clearSessionCookie } from "@/lib/session";

export async function POST() {
  try {
    await clearSessionCookie();
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
