import { surveysCol, reportsCol } from "@/lib/models";
import { SETTLEMENTS } from "@/lib/questionnaire/settlements";

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

export async function computeDashboard(weekStart: Date, weekEnd: Date) {
  const surveys = await surveysCol();
  const reports = await reportsCol();
  const inWeek = { createdAt: { $gte: weekStart, $lte: weekEnd } };

  const [
    householdsWeek,
    householdsCumulative,
    urgentHealth,
    pregnant,
    entitlementGaps,
    followupHouseholds,
    pwd,
    widow,
  ] = await Promise.all([
    surveys.countDocuments(inWeek),
    surveys.countDocuments({}),
    surveys.countDocuments({ "data.health_referral_need": "urgent" }),
    surveys.countDocuments({ "data.has_pregnant_or_lactating": "yes" }),
    surveys.countDocuments({ "data.entitlement_followup_required": { $in: ["yes", "maybe"] } }),
    surveys.countDocuments({
      $or: [
        { "data.entitlement_followup_required": { $in: ["yes", "maybe"] } },
        { "data.health_referral_need": { $in: ["urgent", "routine"] } },
        { "data.followup_required": { $in: ["yes", "maybe"] } },
      ],
    }),
    surveys.countDocuments({ "data.has_pwd_member": "yes" }),
    surveys.countDocuments({ "data.has_widow_single_woman": "yes" }),
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

  const tgAgg = await surveys
    .aggregate([
      {
        $group: {
          _id: null,
          children_0_3: { $sum: { $ifNull: ["$data.num_children_0_3", 0] } },
          children_4_12: { $sum: { $ifNull: ["$data.num_children_4_12", 0] } },
          youth: { $sum: { $ifNull: ["$data.num_youth_13_24", 0] } },
          women: { $sum: { $ifNull: ["$data.num_women_15_49", 0] } },
          elderly: { $sum: { $ifNull: ["$data.num_elderly_60plus", 0] } },
        },
      },
    ])
    .toArray();
  const t = tgAgg[0] || {};

  const weekBy = await surveys
    .aggregate([{ $match: inWeek }, { $group: { _id: "$settlementCode", n: { $sum: 1 } } }])
    .toArray();
  const cumBy = await surveys
    .aggregate([{ $group: { _id: "$settlementCode", n: { $sum: 1 } } }])
    .toArray();
  const weekMap = new Map(weekBy.map((x) => [String(x._id), x.n as number]));
  const cumMap = new Map(cumBy.map((x) => [String(x._id), x.n as number]));
  const settlementSplit = SETTLEMENTS.map((s) => ({
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
    totalSettlements: 12,
    mobiliserDeployment: mobIds.size,
    totalMobilisers: 6,
    householdsWeek,
    householdsCumulative,
    targetHouseholds: 1600,
    followupHouseholds,
    urgentHealth,
    pregnant,
    entitlementGaps,
    pwd,
    widow,
    targets: {
      children_0_3: t.children_0_3 || 0,
      children_4_12: t.children_4_12 || 0,
      youth: t.youth || 0,
      women: t.women || 0,
      elderly: t.elderly || 0,
    },
    settlementSplit,
    dailyReports: daily.count,
    dailySurveysReported: daily.surveysReported,
    dailyUrgentCases: daily.urgentCases,
    dailyFollowUps: daily.followUps,
    computedAt: weekEnd,
  };
}
