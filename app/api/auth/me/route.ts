import { json, handleError, requireUser } from "@/lib/api";
import { publicUser } from "@/lib/serialize";

export async function GET() {
  try {
    const user = await requireUser();
    return json({ user: publicUser(user) });
  } catch (e) {
    return handleError(e);
  }
}
