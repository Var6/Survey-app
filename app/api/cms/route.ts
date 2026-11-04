import { json, handleError, requireUser } from "@/lib/api";
import { usersCol } from "@/lib/models";

export const runtime = "nodejs";

/**
 * Active Community Mobilisers — id, name and code only. Safe for every signed-in
 * role: a CM needs it to tag colleagues on a meeting, staff to assign cases and
 * camps. No contact details leave this endpoint.
 */
export async function GET() {
  try {
    await requireUser();
    const users = await usersCol();
    const list = await users
      .find({ role: "cm", active: { $ne: false } }, { projection: { name: 1, mobiliserCode: 1 } })
      .sort({ name: 1 })
      .toArray();
    return json({
      cms: list.map((u) => ({ id: String(u._id), name: u.name, code: u.mobiliserCode ?? null })),
    });
  } catch (e) {
    return handleError(e);
  }
}
