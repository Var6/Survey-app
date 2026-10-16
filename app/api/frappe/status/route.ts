import { json, handleError, requireRoles } from "@/lib/api";
import { surveysCol } from "@/lib/models";
import {
  HOUSEHOLD_FIELD_MAP,
  MEMBER_FIELD_MAP,
  mapSurveyToFrappe,
  frappeConfigured,
} from "@/lib/frappe";
import { settlementLabels } from "@/lib/settlements";

export const runtime = "nodejs";

/**
 * What the funder's system is actually receiving.
 * For each mapped field it reports how many of the synced households carry a
 * value, so a question that is collected but not arriving is visible at once.
 */
export async function GET() {
  try {
    await requireRoles("director", "programme_manager", "mis");

    const surveys = await surveysCol();
    const labels = await settlementLabels();

    const [total, synced, pending, failed] = await Promise.all([
      surveys.countDocuments({}),
      surveys.countDocuments({ "sync.status": "synced" }),
      surveys.countDocuments({ "sync.status": "pending" }),
      surveys.countDocuments({ "sync.status": "failed" }),
    ]);

    // Sample the most recent synced households and run them through the real
    // mapper, so this page can never disagree with what is sent.
    const sample = await surveys
      .find({ "sync.status": "synced" })
      .sort({ updatedAt: -1 })
      .limit(100)
      .toArray();

    const filled: Record<string, number> = {};
    for (const s of sample) {
      const payload = mapSurveyToFrappe(s, labels[s.settlementCode]);
      for (const key of Object.keys(payload)) {
        if (key === "doctype") continue;
        filled[key] = (filled[key] || 0) + 1;
      }
    }

    const memberRows = sample.reduce((n, s) => n + (s.members?.length || 0), 0);
    const membersPushed = sample.reduce((n, s) => n + (s.sync?.members?.synced || 0), 0);

    return json({
      configured: frappeConfigured(),
      counts: { total, synced, pending, failed, sampled: sample.length },
      members: { inApp: memberRows, pushed: membersPushed },
      household: HOUSEHOLD_FIELD_MAP.map((f) => ({
        frappe: f.frappe,
        source: f.source,
        label: f.label,
        filled: filled[f.frappe] || 0,
      })),
      member: MEMBER_FIELD_MAP.map((f) => ({
        frappe: f.frappe,
        source: f.source,
        label: f.label,
      })),
    });
  } catch (e) {
    return handleError(e);
  }
}
