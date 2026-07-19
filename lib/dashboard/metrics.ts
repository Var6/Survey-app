import { surveysCol } from "@/lib/models";
import { SETTLEMENT_BY_CODE } from "@/lib/questionnaire/settlements";

/**
 * Live programme dashboard metrics, computed dynamically from the survey data.
 * The 10 cards follow the "Dashboard main page headings" spec. Cards that would
 * need a full case-management module (open/overdue/director-intervention) use a
 * faithful survey-derived approximation until that module exists.
 */

const YES_MAYBE = ["yes", "maybe"];
const URGENT_ROUTINE = ["urgent", "routine"];

export interface DashboardMetrics {
  householdsSurveyed: { count: number; target: number; percent: number };
  householdsFollowup: number;
  openActionCases: number;
  overdueCases: number;
  highPriority: number;
  outOfSchool: number;
  pwd: { total: number; children: number; adults: number };
  pregnantFollowup: number;
  pendingDocs: number;
  directorIntervention: number;
  /** Case load split by thematic area (for the donut / bars). */
  needsByCategory: { key: string; label: string; value: number }[];
  /** Surveys per settlement (for the settlement bar chart). */
  bySettlement: { code: string; label: string; value: number }[];
}

export async function computeDashboardMetrics(): Promise<DashboardMetrics> {
  const surveys = await surveysCol();
  const today = new Date().toISOString().slice(0, 10);

  const [
    householdsSurveyed,
    householdsFollowup,
    entitlementCases,
    healthCases,
    maternalCases,
    highPriority,
    pregnantFollowup,
    pendingDocs,
    overdueCases,
    directorIntervention,
  ] = await Promise.all([
    surveys.countDocuments({}),
    surveys.countDocuments({
      $or: [
        { "data.followup_required": { $in: YES_MAYBE } },
        { "data.entitlement_followup_required": { $in: YES_MAYBE } },
        { "data.health_referral_need": { $in: URGENT_ROUTINE } },
        { "data.maternal_followup_required": { $in: URGENT_ROUTINE } },
      ],
    }),
    surveys.countDocuments({ "data.entitlement_followup_required": { $in: YES_MAYBE } }),
    surveys.countDocuments({ "data.health_referral_need": { $in: URGENT_ROUTINE } }),
    surveys.countDocuments({
      "data.has_pregnant_or_lactating": "yes",
      "data.maternal_followup_required": { $in: URGENT_ROUTINE },
    }),
    surveys.countDocuments({
      $or: [
        { "data.priority_level": "high" },
        { "data.health_referral_need": "urgent" },
        { "data.maternal_followup_required": "urgent" },
        { "data.followup_type": "urgent" },
      ],
    }),
    surveys.countDocuments({
      "data.has_pregnant_or_lactating": "yes",
      $or: [
        { "data.maternal_followup_required": { $in: URGENT_ROUTINE } },
        { "data.registered_with_asha_anm": { $in: ["no", "dont_know"] } },
        { "data.anc_checkup_done": "no" },
        { "data.icds_linked": { $in: ["no", "irregular"] } },
      ],
    }),
    surveys.countDocuments({
      $or: [
        { "data.entitlement_followup_required": { $in: YES_MAYBE } },
        { "data.all_have_aadhaar": { $in: ["some", "none", "correction"] } },
        { "data.has_ration_card": { $in: ["no", "applied", "not_received"] } },
        { "data.has_ayushman_card": { $in: ["some", "none"] } },
        { "data.birth_cert_children": { $in: ["some", "none"] } },
        { "data.pension_need": { $in: ["old_age", "widow", "disability"] } },
      ],
    }),
    // Overdue: a follow-up date that has already passed.
    surveys.countDocuments({ "data.next_followup_date": { $lt: today, $gt: "" } }),
    // Escalated to Director / flagged urgent.
    surveys.countDocuments({
      $or: [{ "data.next_action": "escalate" }, { "data.followup_type": "urgent" }],
    }),
  ]);

  const pensionCases = await surveys.countDocuments({
    "data.pension_need": { $in: ["old_age", "widow", "disability"] },
  });

  const [oosAgg, pwdAgg, settlementAgg] = await Promise.all([
    surveys
      .aggregate([
        {
          $group: {
            _id: null,
            total: {
              $sum: {
                $size: {
                  $ifNull: [
                    {
                      $filter: {
                        input: { $ifNull: ["$children_4_12", []] },
                        as: "c",
                        cond: {
                          $in: [
                            "$$c.child_school_status",
                            ["never_enrolled", "dropped_out", "enrolled_not_attending"],
                          ],
                        },
                      },
                    },
                    [],
                  ],
                },
              },
            },
          },
        },
      ])
      .toArray(),
    surveys
      .aggregate([
        {
          $project: {
            pwd: {
              $filter: {
                input: { $ifNull: ["$members", []] },
                as: "m",
                cond: { $in: ["$$m.member_disability", ["yes_cert", "yes_no_cert"]] },
              },
            },
          },
        },
        {
          $project: {
            total: { $size: "$pwd" },
            children: {
              $size: {
                $filter: {
                  input: "$pwd",
                  as: "m",
                  cond: {
                    $lt: [
                      { $convert: { input: "$$m.member_age", to: "int", onError: 99, onNull: 99 } },
                      18,
                    ],
                  },
                },
              },
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" }, children: { $sum: "$children" } } },
      ])
      .toArray(),
    surveys
      .aggregate([
        { $group: { _id: "$settlementCode", value: { $sum: 1 } } },
        { $sort: { value: -1 } },
      ])
      .toArray(),
  ]);

  const outOfSchool = (oosAgg[0]?.total as number) || 0;
  const pwdTotal = (pwdAgg[0]?.total as number) || 0;
  const pwdChildren = (pwdAgg[0]?.children as number) || 0;

  const bySettlement = settlementAgg.map((s) => {
    const code = (s._id as string) || "unknown";
    return {
      code,
      label: SETTLEMENT_BY_CODE[code]?.label || code,
      value: s.value as number,
    };
  });

  const needsByCategory = [
    { key: "entitlements", label: "Entitlements & documents", value: pendingDocs },
    { key: "health", label: "Health referrals", value: healthCases },
    { key: "maternal", label: "Maternal & ICDS", value: maternalCases },
    { key: "education", label: "Out-of-school children", value: outOfSchool },
    { key: "disability", label: "Disability support", value: pwdTotal },
    { key: "pension", label: "Pension", value: pensionCases },
  ];

  return {
    householdsSurveyed: {
      count: householdsSurveyed,
      target: 1600,
      percent: Math.round((householdsSurveyed / 1600) * 100),
    },
    householdsFollowup,
    openActionCases: entitlementCases + healthCases + maternalCases + outOfSchool,
    overdueCases,
    highPriority,
    outOfSchool,
    pwd: { total: pwdTotal, children: pwdChildren, adults: pwdTotal - pwdChildren },
    pregnantFollowup,
    pendingDocs,
    directorIntervention,
    needsByCategory,
    bySettlement,
  };
}
