import { ObjectId } from "mongodb";
import {
  ensureIndexes,
  notificationsCol,
  usersCol,
  type NotificationCategory,
  type NotificationDoc,
  type Role,
} from "./models";

/**
 * The one notification pipeline. Every feature (cases, camps, meetings,
 * reports) calls notifyUsers / notifyRoles; nothing writes the collection
 * directly.
 *
 * Privacy: titles and bodies carry references (case id, household id, camp
 * code, staff names) — never a beneficiary's name or phone number.
 *
 * Idempotency: each notification has a `dedupeKey`, unique per recipient. A
 * retried request or job upserts the same key, so nobody is notified twice.
 */

export interface NotifyInput {
  category: NotificationCategory;
  title: string;
  body: string;
  relatedType?: NotificationDoc["relatedType"];
  relatedId?: string;
  /** Identifies the event (e.g. `followup:<id>`). Required — it is the retry guard. */
  dedupeKey: string;
}

const toId = (v: ObjectId | string) => (typeof v === "string" ? new ObjectId(v) : v);

/** Notify specific users. Never throws; returns how many were newly created. */
export async function notifyUsers(
  userIds: (ObjectId | string)[],
  n: NotifyInput,
  opts: { excludeUserId?: ObjectId | string } = {}
): Promise<number> {
  try {
    const skip = opts.excludeUserId ? String(opts.excludeUserId) : null;
    const unique = [...new Set(userIds.map(String))].filter((id) => id !== skip);
    if (unique.length === 0) return 0;

    await ensureIndexes();
    const col = await notificationsCol();
    const now = new Date();
    const res = await col.bulkWrite(
      unique.map((id) => ({
        updateOne: {
          filter: { userId: toId(id), dedupeKey: n.dedupeKey },
          update: {
            $setOnInsert: {
              userId: toId(id),
              category: n.category,
              title: n.title,
              body: n.body,
              relatedType: n.relatedType,
              relatedId: n.relatedId,
              dedupeKey: n.dedupeKey,
              readAt: null,
              createdAt: now,
            },
          },
          upsert: true,
        },
      })),
      { ordered: false }
    );
    return res.upsertedCount;
  } catch (e) {
    console.error("[notify] could not create notifications:", e);
    return 0;
  }
}

/** Ids of the active users holding any of the given roles. */
export async function userIdsWithRoles(roles: Role[]): Promise<ObjectId[]> {
  const users = await usersCol();
  const docs = await users
    .find({ role: { $in: roles }, active: { $ne: false } }, { projection: { _id: 1 } })
    .toArray();
  return docs.map((d) => d._id!);
}

/** Notify everyone holding one of the roles. */
export async function notifyRoles(
  roles: Role[],
  n: NotifyInput,
  opts: { excludeUserId?: ObjectId | string } = {}
): Promise<number> {
  try {
    const ids = await userIdsWithRoles(roles);
    return notifyUsers(ids, n, opts);
  } catch (e) {
    console.error("[notify] could not resolve recipients:", e);
    return 0;
  }
}

/** Unread count for the bell. */
export async function unreadCount(userId: ObjectId): Promise<number> {
  const col = await notificationsCol();
  return col.countDocuments({ userId, readAt: null });
}
