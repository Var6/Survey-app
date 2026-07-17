import { json, handleError, requireDirector } from "@/lib/api";
import { surveysCol } from "@/lib/models";
import { syncSurveyById } from "@/lib/frappe";
import { frappeConfigured } from "@/lib/frappe";

export const runtime = "nodejs";

const BATCH = 50;

export async function POST() {
  try {
    await requireDirector();
    if (!frappeConfigured()) {
      return json({ error: "Frappe is not configured in .env.local" }, 503);
    }

    const surveys = await surveysCol();
    const docs = await surveys
      .find({ "sync.status": { $ne: "synced" } })
      .sort({ createdAt: 1 })
      .limit(BATCH)
      .toArray();

    let synced = 0;
    let failed = 0;
    for (const s of docs) {
      const state = await syncSurveyById(s._id!);
      if (state.status === "synced") synced++;
      else failed++;
    }

    return json({ attempted: docs.length, synced, failed, batch: BATCH });
  } catch (e) {
    return handleError(e);
  }
}
