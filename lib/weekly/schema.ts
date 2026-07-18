import type { Section, Option, Field } from "@/lib/questionnaire";

/**
 * Programme Manager weekly report — accountability fields (PMW Sections A,C,E–M).
 * Section B (settlement traffic-lights), D (auto vulnerability dashboard) and
 * N (certification) are handled by dedicated components.
 */

const o = (code: string, en: string): Option => ({ code, en, hi: en });
const yesno = (): Option[] => [o("yes", "Yes"), o("no", "No")];

export const WEEKLY_SECTIONS: Section[] = [
  {
    id: "A",
    title: { en: "Weekly control statement" },
    items: [
      {
        qid: "overall_status",
        name: "overall_status",
        label: { en: "Overall project status this week" },
        type: "select",
        options: [
          o("on_track", "On track"),
          o("minor", "Minor concerns"),
          o("significant", "Significant concerns"),
          o("critical", "Critical attention required"),
        ],
        required: true,
      },
      {
        qid: "key_facts",
        name: "key_facts",
        label: { en: "Three most important facts the Director should know" },
        type: "textarea",
        required: true,
      },
      {
        qid: "data_issue",
        name: "data_issue",
        label: { en: "Did any dashboard figure appear incorrect / incomplete?" },
        type: "select",
        options: yesno(),
      },
      {
        qid: "data_issue_details",
        name: "data_issue_details",
        label: { en: "Data issue details + correction assigned" },
        type: "textarea",
        showWhen: { field: "data_issue", eq: "yes" },
      },
    ],
  },
  {
    id: "C",
    title: { en: "Survey progress & data quality" },
    items: [
      {
        qid: "survey_plan_met",
        name: "survey_plan_met",
        label: { en: "Were surveys conducted per the weekly plan?" },
        type: "select",
        options: [o("yes", "Yes"), o("partly", "Partly"), o("no", "No")],
        required: true,
      },
      {
        qid: "behind_reason",
        name: "behind_reason",
        label: { en: "Which settlements / mobilisers are behind, and why?" },
        type: "textarea",
        showWhen: { field: "survey_plan_met", in: ["partly", "no"] },
      },
      {
        qid: "data_quality_problems",
        name: "data_quality_problems",
        label: { en: "Data-quality problems identified this week" },
        type: "multiselect",
        options: [
          o("duplicates", "Duplicate records"),
          o("missing_fields", "Missing mandatory fields"),
          o("count_mismatch", "Roster / count mismatch"),
          o("no_gps", "Surveys without GPS"),
          o("stale_forms", "Stale partial forms"),
          o("none", "None"),
        ],
      },
      {
        qid: "corrective_action",
        name: "corrective_action",
        label: { en: "Corrective action you personally ensured" },
        type: "textarea",
      },
      {
        qid: "records_verified",
        name: "records_verified",
        label: { en: "How many survey records did you personally review?" },
        type: "integer",
        validation: { min: 0, max: 9999 },
      },
    ],
  },
  {
    id: "E",
    title: { en: "Health & maternal-health accountability" },
    items: [
      {
        qid: "urgent_health_reviewed",
        name: "urgent_health_reviewed",
        label: { en: "Reviewed every urgent health / maternal case this week?" },
        type: "select",
        options: yesno(),
        required: true,
      },
      {
        qid: "urgent_health_action",
        name: "urgent_health_action",
        label: { en: "For each unresolved urgent case, action taken (owner, next date)" },
        type: "textarea",
      },
      {
        qid: "director_intervention_health",
        name: "director_intervention_health",
        label: { en: "Is Director-level intervention required (health)?" },
        type: "select",
        options: yesno(),
      },
    ],
  },
  {
    id: "F",
    title: { en: "Entitlement & documentation accountability" },
    items: [
      {
        qid: "entitlement_bottleneck",
        name: "entitlement_bottleneck",
        label: { en: "What bottleneck affected entitlement progress this week?" },
        type: "multiselect",
        options: [
          o("household_docs", "Household documents"),
          o("department_delay", "Department delay"),
          o("staff_followup", "Staff follow-up"),
          o("camp_pending", "Camp pending"),
          o("technical", "Technical"),
          o("other", "Other"),
        ],
      },
      {
        qid: "entitlement_action",
        name: "entitlement_action",
        label: { en: "Management action taken (owner + deadline)" },
        type: "textarea",
      },
    ],
  },
  {
    id: "G",
    title: { en: "Children, education & youth oversight" },
    items: [
      {
        qid: "oos_owner_assigned",
        name: "oos_owner_assigned",
        label: { en: "Did every new out-of-school child get a named follow-up owner?" },
        type: "select",
        options: yesno(),
      },
      {
        qid: "weak_engagement",
        name: "weak_engagement",
        label: { en: "Settlements with weak children / youth engagement" },
        type: "text",
      },
      {
        qid: "engagement_quality_action",
        name: "engagement_quality_action",
        label: { en: "What did you do to improve the quality of engagement (not just attendance)?" },
        type: "textarea",
      },
    ],
  },
  {
    id: "H",
    title: { en: "Team performance & field supervision" },
    items: [
      {
        qid: "team_supervision",
        name: "team_supervision",
        label: { en: "Field supervision you conducted (date, settlement, staff, purpose)" },
        type: "textarea",
      },
      {
        qid: "staff_concern",
        name: "staff_concern",
        label: { en: "Any attendance, conduct or discipline issue?" },
        type: "select",
        options: yesno(),
      },
      {
        qid: "staff_concern_detail",
        name: "staff_concern_detail",
        label: { en: "Details (confidential)" },
        type: "textarea",
        showWhen: { field: "staff_concern", eq: "yes" },
      },
    ],
  },
  {
    id: "I",
    title: { en: "MIS, evidence & data-quality ownership" },
    items: [
      {
        qid: "mis_review_done",
        name: "mis_review_done",
        label: { en: "Weekly data review with the MIS Supervisor done?" },
        type: "select",
        options: yesno(),
      },
      {
        qid: "evidence_weaknesses",
        name: "evidence_weaknesses",
        label: { en: "Top data / evidence weaknesses this week" },
        type: "textarea",
      },
      {
        qid: "donor_evidence_risk",
        name: "donor_evidence_risk",
        label: { en: "Any donor evidence at risk of being unavailable / weak?" },
        type: "select",
        options: yesno(),
      },
    ],
  },
  {
    id: "J",
    title: { en: "Government & stakeholder coordination" },
    items: [
      {
        qid: "stakeholder_engaged",
        name: "stakeholder_engaged",
        label: { en: "Coordination this week (who, purpose, outcome, follow-up)" },
        type: "textarea",
      },
    ],
  },
  {
    id: "K",
    title: { en: "Risks, incidents & escalation" },
    items: [
      {
        qid: "new_risk",
        name: "new_risk",
        label: { en: "Any new risk / incident this week?" },
        type: "select",
        options: yesno(),
      },
      {
        qid: "risk_category",
        name: "risk_category",
        label: { en: "Risk category" },
        type: "multiselect",
        options: [
          o("safeguarding", "Safeguarding"),
          o("health_emergency", "Health emergency"),
          o("community", "Community / access"),
          o("staff", "Staff"),
          o("data_privacy", "Data / privacy"),
          o("financial", "Financial / operational"),
          o("reputational", "Reputational / donor"),
        ],
        showWhen: { field: "new_risk", eq: "yes" },
      },
      {
        qid: "risk_detail",
        name: "risk_detail",
        label: { en: "Risk description + immediate action taken" },
        type: "textarea",
        showWhen: { field: "new_risk", eq: "yes" },
      },
      {
        qid: "risk_severity",
        name: "risk_severity",
        label: { en: "Severity" },
        type: "select",
        options: [o("low", "Low"), o("medium", "Medium"), o("high", "High"), o("critical", "Critical")],
        showWhen: { field: "new_risk", eq: "yes" },
      },
      {
        qid: "director_informed_risk",
        name: "director_informed_risk",
        label: { en: "Director informed?" },
        type: "select",
        options: yesno(),
        showWhen: { field: "new_risk", eq: "yes" },
      },
    ],
  },
  {
    id: "M",
    title: { en: "Plan & ownership for next week" },
    items: [
      {
        qid: "next_week_priorities",
        name: "next_week_priorities",
        label: { en: "Top 3–5 priorities for next week (with owners + deadlines)" },
        type: "textarea",
        required: true,
      },
      {
        qid: "pm_own_action",
        name: "pm_own_action",
        label: { en: "Your own supervision / coordination action for next week" },
        type: "textarea",
      },
      {
        qid: "support_required",
        name: "support_required",
        label: { en: "Dependency / support required" },
        type: "multiselect",
        options: [
          o("director", "Director"),
          o("mis", "MIS"),
          o("accountant", "Accountant"),
          o("government", "Government"),
          o("developer", "Developer"),
          o("none", "None"),
        ],
      },
    ],
  },
];

export const CERTIFICATION = [
  { key: "cert_01", label: "I have reviewed data for all 12 settlements and all assigned mobilisers." },
  { key: "cert_02", label: "I have reviewed all urgent health, safeguarding and critical-risk alerts this week." },
  { key: "cert_03", label: "I have assigned owners and deadlines for material pending actions." },
  { key: "cert_04", label: "I have disclosed known delays, quality gaps and risks honestly." },
];
