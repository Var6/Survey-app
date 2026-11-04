import { json, handleError, requireUser } from "@/lib/api";
import { notificationsCol, type NotificationCategory } from "@/lib/models";
import { publicNotification } from "@/lib/serialize";

export const runtime = "nodejs";

const CATEGORIES: NotificationCategory[] = [
  "case_opened",
  "followup_completed",
  "closure_requested",
  "closure_approved",
  "closure_rejected",
  "camp_created",
  "camp_updated",
  "meeting_created",
  "meeting_updated",
  "meeting_invited",
  "meeting_report",
  "camp_report",
  "report_reminder",
];

/**
 * The signed-in user's own notifications — always scoped to them, so nobody
 * can read another person's. `countOnly=1` is the cheap call the bell polls.
 */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const p = new URL(req.url).searchParams;
    const col = await notificationsCol();

    if (p.get("countOnly") === "1") {
      return json({ unread: await col.countDocuments({ userId: user._id, readAt: null }) });
    }

    const filter: Record<string, unknown> = { userId: user._id };
    if (p.get("unread") === "1") filter.readAt = null;
    const cat = p.get("category");
    if (cat && (CATEGORIES as string[]).includes(cat)) filter.category = cat;

    const page = Math.max(Number(p.get("page")) || 1, 1);
    const pageSize = Math.min(Math.max(Number(p.get("pageSize")) || 25, 1), 100);

    const [docs, total, unread] = await Promise.all([
      col
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .toArray(),
      col.countDocuments(filter),
      col.countDocuments({ userId: user._id, readAt: null }),
    ]);
    return json({
      notifications: docs.map(publicNotification),
      total,
      unread,
      page,
      pageSize,
      pages: Math.max(Math.ceil(total / pageSize), 1),
    });
  } catch (e) {
    return handleError(e);
  }
}
