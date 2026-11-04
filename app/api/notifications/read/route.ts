import { ObjectId } from "mongodb";
import { json, handleError, requireUser, readJson, HttpError } from "@/lib/api";
import { notificationsCol } from "@/lib/models";

export const runtime = "nodejs";

/** Mark some (ids) or all of the user's own notifications as read. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await readJson<{ ids?: string[]; all?: boolean }>(req);
    const col = await notificationsCol();
    const now = new Date();

    if (body.all) {
      const res = await col.updateMany({ userId: user._id, readAt: null }, { $set: { readAt: now } });
      return json({ ok: true, updated: res.modifiedCount });
    }
    if (!Array.isArray(body.ids) || body.ids.length === 0) {
      throw new HttpError(400, "Nothing to mark as read");
    }
    const ids = body.ids.slice(0, 200).map((i) => {
      try {
        return new ObjectId(i);
      } catch {
        throw new HttpError(400, "Invalid notification id");
      }
    });
    // userId in the filter: you can only ever touch your own notifications.
    const res = await col.updateMany(
      { _id: { $in: ids }, userId: user._id, readAt: null },
      { $set: { readAt: now } }
    );
    return json({ ok: true, updated: res.modifiedCount });
  } catch (e) {
    return handleError(e);
  }
}
