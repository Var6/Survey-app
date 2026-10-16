import { json, handleError, requireRoles } from "@/lib/api";
import { surveysCol } from "@/lib/models";
import { syncSurveyById } from "@/lib/frappe";
import { frappeConfigured } from "@/lib/frappe";

export const runtime = "nodejs";

const BATCH = 50;

/**
 * Re-send households to the funder, 50 at a time.
 *   default      only the ones that are not synced yet
 *   ?scope=all   every household — used to backfill the newly mapped fields
 *                and the Family Member records onto already-synced households
 */
export async function POST(req: Request) {
  try {
    await requireRoles("director", "programme_manager", "mis");
    if (!frappeConfigured()) {
      return json({ error: "Frappe is not configured in .env.local" }, 503);
    }

    const all = new URL(req.url).searchParams.get("scope") === "all";
    const surveys = await surveysCol();
    // Oldest first when backfilling, so repeated runs march through the list.
    const filter = all
      ? { status: "complete" as const }
      : { "sync.status": { $ne: "synced" } };
    const sort: Record<string, 1 | -1> = all ? { "sync.syncedAt": 1 } : { createdAt: 1 };
    const docs = await surveys.find(filter).sort(sort).limit(BATCH).toArray();

    let synced = 0;
    let failed = 0;
    for (const s of docs) {
      const state = await syncSurveyById(s._id!);
      if (state.status === "synced") synced++;
      else failed++;
    }

    const remaining = all
      ? await surveys.countDocuments({
          status: "complete",
          $or: [
            { "sync.members": { $exists: false } },
            { "sync.status": { $ne: "synced" } },
          ],
        })
      : await surveys.countDocuments({ "sync.status": { $ne: "synced" } });

    return json({ attempted: docs.length, synced, failed, batch: BATCH, remaining });
  } catch (e) {
    return handleError(e);
  }
}
