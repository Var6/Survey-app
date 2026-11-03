import { ObjectId } from "mongodb";
import {
  monthlyReportsCol,
  usersCol,
  type MonthlyReportDoc,
  type UserDoc,
} from "@/lib/models";
import { defaultReportMonth, monthKey } from "./month";

/* Server-side readers for the monthly report pages. Imports the database, so
   never pull this into a client component — use lib/monthly/month.ts there. */

function monthRange(key: string) {
  const [y, m] = key.split("-").map(Number);
  return { $gte: new Date(Date.UTC(y, m - 1, 1)), $lt: new Date(Date.UTC(y, m, 1)) };
}

/**
 * The month a NEW report should open on. Normally the month that just
 * finished; once that one is filed, the current month. A draft or returned
 * report still counts as open, so the author lands back on it rather than
 * being offered a month they cannot file for.
 */
export async function suggestOpenMonth(userId: ObjectId): Promise<string> {
  const now = new Date();
  const current = monthKey(now);
  const candidates = [...new Set([defaultReportMonth(now), current])];
  const col = await monthlyReportsCol();

  for (const key of candidates) {
    const docs = await col
      .find(
        { programmeManagerId: userId, monthStart: monthRange(key) },
        { projection: { status: 1 } }
      )
      .toArray();
    const open = docs.length === 0 || docs.some((d) => d.status === "draft" || d.status === "returned");
    if (open) return key;
  }
  // Everything recent is already filed; the form's month picker lets them
  // choose, so fall back to the current month.
  return current;
}

/**
 * One report by id, with the access rule the read-only view relies on: the
 * Director, Programme Manager and MIS Supervisor read every report, a
 * Community Mobiliser only their own. Null when missing or not allowed.
 */
export async function loadMonthlyReportForUser(
  id: string,
  user: UserDoc
): Promise<{ doc: MonthlyReportDoc; authorName?: string } | null> {
  let _id: ObjectId;
  try {
    _id = new ObjectId(id);
  } catch {
    return null;
  }

  const col = await monthlyReportsCol();
  const doc = await col.findOne({ _id });
  if (!doc) return null;

  const isOwner = String(doc.programmeManagerId) === String(user._id);
  const readsAll =
    user.role === "director" || user.role === "programme_manager" || user.role === "mis";
  if (!readsAll && !(user.role === "cm" && isOwner)) return null;

  const users = await usersCol();
  const author = await users.findOne(
    { _id: doc.programmeManagerId },
    { projection: { name: 1 } }
  );
  return { doc, authorName: author?.name ?? doc.pmName };
}
