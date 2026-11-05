import { surveysCol, reportsCol } from "@/lib/models";
import { listSettlements } from "@/lib/settlements";
import {
  TARGET_HOUSEHOLDS,
  completeSurveyFilter,
  countActiveMobilisers,
  countCasesFor,
  countCompleteSurveys,
  countFollowupHouseholds,
  countTargetGroups,
} from "@/lib/dashboard/definitions";

/** ISO-ish week bucket (Monday–Sunday) for a given date. */
export function weekOf(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dow = d.getUTCDay() || 7; // Mon=1..Sun=7
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (dow - 1));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  // ISO week number
  const target = new Date(monday);
  target.setUTCDate(target.getUTCDate() + 3); // Thursday of this week
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      (target.getTime() - firstThursday.getTime()) / 86400000 / 7
    );
  const year = target.getUTCFullYear();
  const reportId = `PMW-${year}-${String(week).padStart(2, "0")}`;
  return { weekStart: monday, weekEnd: sunday, week, year, reportId };
}

/**
 * Weekly / monthly dashboard. Every figure that the programme dashboard also
 * shows is counted the same way (see lib/dashboard/definitions.ts): complete
 * surveys for households, the case list's own filter for case figures, the
 * member list for people. Only the "this period" numbers depend on the dates.
 */
export async function computeDashboard(weekStart: Date, weekEnd: Date) {
  const surveys = await surveysCol();
  const reports = await reportsCol();
  const complete = completeSurveyFilter();
  const inWeek = { ...complete, createdAt: { $gte: weekStart, $lte: weekEnd } };
  const director = { _id: undefined, role: "director" } as never;
  const cases = (q: string, module?: string) => countCasesFor(director, q, module);

  const [
    householdsWeek,
    householdsCumulative,
    urgentHealth,
    maternalOpen,
    pregnantWomen,
    mothersWithNewborn,
    entitlementGaps,
    followupHouseholds,
    pwd,
    widow,
    targets,
    settlementRows,
    totalMobilisers,
  ] = await Promise.all([
    surveys.countDocuments(inWeek),
    countCompleteSurveys(),
    cases("status=open&priority=urgent", "health"),
    cases("status=open", "maternal"),
    cases("status=open&segment=pregnant", "maternal"),
    cases("status=open&segment=newborn_mother", "maternal"),
    cases("status=open", "entitlements"),
    countFollowupHouseholds(),
    countCompleteSurveys("pwd=1"),
    surveys.countDocuments({ ...complete, "data.has_widow_single_woman": "yes" }),
    countTargetGroups(),
    listSettlements(),
    countActiveMobilisers(),
  ]);

  const settlementsCovered = (await surveys.distinct("settlementCode", inWeek)).length;

  const mobIds = new Set<string>();
  (await surveys.distinct("mobiliserId", inWeek)).forEach((id) => mobIds.add(String(id)));
  (
    await reports.distinct("mobiliserId", {
      period: "daily",
      createdAt: { $gte: weekStart, $lte: weekEnd },
    })
  ).forEach((id) => mobIds.add(String(id)));

  const weekBy = await surveys
    .aggregate([{ $match: inWeek }, { $group: { _id: "$settlementCode", n: { $sum: 1 } } }])
    .toArray();
  const cumBy = await surveys
    .aggregate([{ $match: complete }, { $group: { _id: "$settlementCode", n: { $sum: 1 } } }])
    .toArray();
  const weekMap = new Map(weekBy.map((x) => [String(x._id), x.n as number]));
  const cumMap = new Map(cumBy.map((x) => [String(x._id), x.n as number]));
  const settlementSplit = settlementRows.map((s) => ({
    code: s.code,
    label: s.label,
    week: weekMap.get(s.code) || 0,
    cumulative: cumMap.get(s.code) || 0,
  }));

  const drAgg = await reports
    .aggregate([
      { $match: { period: "daily", createdAt: { $gte: weekStart, $lte: weekEnd } } },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          surveysReported: { $sum: { $ifNull: ["$data.surveys_completed", 0] } },
          urgentCases: { $sum: { $ifNull: ["$data.urgent_health_cases", 0] } },
          followUps: { $sum: { $ifNull: ["$data.households_followed_up", 0] } },
        },
      },
    ])
    .toArray();
  const daily = drAgg[0] || { count: 0, surveysReported: 0, urgentCases: 0, followUps: 0 };

  return {
    settlementsCovered,
    totalSettlements: settlementRows.length,
    mobiliserDeployment: mobIds.size,
    totalMobilisers,
    householdsWeek,
    householdsCumulative,
    targetHouseholds: TARGET_HOUSEHOLDS,
    followupHouseholds,
    urgentHealth,
    // Pregnant women and mothers with a newborn are both maternal cases.
    pregnant: maternalOpen,
    pregnantWomen,
    mothersWithNewborn,
    entitlementGaps,
    pwd,
    widow,
    targets: {
      children_0_3: targets.children_0_3,
      children_4_12: targets.children_4_12,
      youth: targets.youth,
      women: targets.women,
      elderly: targets.elderly,
    },
    settlementSplit,
    dailyReports: daily.count,
    dailySurveysReported: daily.surveysReported,
    dailyUrgentCases: daily.urgentCases,
    dailyFollowUps: daily.followUps,
    computedAt: weekEnd,
  };
}
