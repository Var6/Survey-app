import type { Section, Option } from "@/lib/questionnaire";

/**
 * Programme Manager monthly report (PMM) — accountability narrative sections.
 * Section A/B dashboards and Section G case table are auto-populated; the
 * settlement control (Section C) uses the shared SettlementControl component.
 */

const o = (code: string, en: string): Option => ({ code, en, hi: en });
const yesno = (): Option[] => [o("yes", "Yes"), o("no", "No")];

export const MONTHLY_SECTIONS: Section[] = [
  {
    id: "A",
    title: { en: "Monthly summary" },
    items: [
      {
        qid: "overall_status",
        name: "overall_status",
        label: { en: "Overall status of the project this month" },
        type: "select",
        options: [
          o("on_track", "On track"),
          o("minor", "Minor concerns"),
          o("significant", "Significant concerns"),
          o("critical", "Critical attention"),
        ],
        required: true,
      },
      {
        qid: "achievements",
        name: "achievements",
        label: { en: "Three most important achievements this month" },
        type: "textarea",
        required: true,
      },
      {
        qid: "gaps",
        name: "gaps",
        label: { en: "Three most important gaps or delays" },
        type: "textarea",
        required: true,
      },
      {
        qid: "personal_action",
        name: "personal_action",
        label: { en: "What did you personally do to address the main gaps?" },
        type: "textarea",
      },
    ],
  },
  {
    id: "D",
    title: { en: "Programme Manager's field work" },
    items: [
      {
        qid: "field_days",
        name: "field_days",
        label: { en: "Number of field days completed this month" },
        type: "integer",
      },
      {
        qid: "settlements_visited",
        name: "settlements_visited",
        label: { en: "Which settlements did you personally visit and why?" },
        type: "textarea",
      },
      {
        qid: "field_observations",
        name: "field_observations",
        label: { en: "Most important field observations (up to five)" },
        type: "textarea",
      },
      {
        qid: "cases_verified",
        name: "cases_verified",
        label: { en: "Which household/community cases did you personally verify?" },
        type: "textarea",
      },
      {
        qid: "corrective_instruction",
        name: "corrective_instruction",
        label: { en: "Corrective instructions given after field visits (+ owner + review date)" },
        type: "textarea",
      },
      {
        qid: "personal_followup",
        name: "personal_followup",
        label: { en: "Field issue still requiring your personal follow-up" },
        type: "textarea",
      },
    ],
  },
  {
    id: "E",
    title: { en: "Youth meetings attended" },
    items: [
      {
        qid: "youth_meetings",
        name: "youth_meetings",
        label: { en: "Youth meetings personally attended this month" },
        type: "textarea",
      },
      {
        qid: "youth_quality",
        name: "youth_quality",
        label: { en: "Observations on meeting quality and youth participation" },
        type: "textarea",
      },
      {
        qid: "youth_leaders",
        name: "youth_leaders",
        label: { en: "Potential youth leaders identified" },
        type: "textarea",
      },
    ],
  },
  {
    id: "F",
    title: { en: "Team supervision & performance" },
    items: [
      {
        qid: "team_performance",
        name: "team_performance",
        label: { en: "Performance status for each mobiliser and MIS Supervisor" },
        type: "textarea",
      },
      {
        qid: "staff_support",
        name: "staff_support",
        label: { en: "Staff requiring support or corrective action (+ reason)" },
        type: "textarea",
      },
      {
        qid: "coaching",
        name: "coaching",
        label: { en: "Coaching, mentoring or instructions provided (+ follow-up date)" },
        type: "textarea",
      },
      {
        qid: "recognition",
        name: "recognition",
        label: { en: "Good performance to recognise (optional)" },
        type: "textarea",
      },
    ],
  },
  {
    id: "G",
    title: { en: "Action cases accountability" },
    items: [
      {
        qid: "overdue_reasons",
        name: "overdue_reasons",
        label: { en: "Which cases remained overdue for reasons within the team's control?" },
        type: "textarea",
      },
      {
        qid: "delay_action",
        name: "delay_action",
        label: { en: "Action taken against repeated follow-up delays (+ staff owner)" },
        type: "textarea",
      },
      {
        qid: "director_cases",
        name: "director_cases",
        label: { en: "Cases requiring Director or senior government intervention" },
        type: "textarea",
      },
    ],
  },
  {
    id: "H",
    title: { en: "Data, evidence & reporting quality" },
    items: [
      {
        qid: "data_review_done",
        name: "data_review_done",
        label: { en: "Did you conduct the monthly data review with the MIS Supervisor?" },
        type: "select",
        options: yesno(),
      },
      {
        qid: "data_weakness",
        name: "data_weakness",
        label: { en: "Main data or evidence weakness (up to three)" },
        type: "textarea",
      },
      {
        qid: "data_correction",
        name: "data_correction",
        label: { en: "Correction agreed, responsible staff and deadline" },
        type: "textarea",
      },
    ],
  },
  {
    id: "I",
    title: { en: "Government coordination, risks & Director support" },
    items: [
      {
        qid: "govt_coordination",
        name: "govt_coordination",
        label: { en: "Most important government coordination undertaken (stakeholder, issue, outcome)" },
        type: "textarea",
      },
      {
        qid: "major_risk",
        name: "major_risk",
        label: { en: "Major risk or implementation concern (+ current action)" },
        type: "textarea",
      },
      {
        qid: "director_support",
        name: "director_support",
        label: { en: "Exact support or decision required from Director (+ deadline)" },
        type: "textarea",
      },
    ],
  },
  {
    id: "J",
    title: { en: "Learning & next-month plan" },
    items: [
      {
        qid: "learnings",
        name: "learnings",
        label: { en: "What did the team learn this month? (up to three)" },
        type: "textarea",
      },
      {
        qid: "changes",
        name: "changes",
        label: { en: "What will you change next month? (up to three)" },
        type: "textarea",
      },
      {
        qid: "next_month_priorities",
        name: "next_month_priorities",
        label: { en: "Top priorities for next month (settlement, target, owner, deadline)" },
        type: "textarea",
        required: true,
      },
    ],
  },
];

export const MONTHLY_CERTIFICATION: { key: string; label: string }[] = [
  { key: "cert_01", label: "I have reviewed progress across all 12 settlements." },
  { key: "cert_02", label: "I have reviewed all urgent, overdue and Director-intervention cases." },
  {
    key: "cert_03",
    label: "I have reviewed staff performance and issued required follow-up instructions.",
  },
  {
    key: "cert_04",
    label: "I have disclosed known delays, field gaps, data weaknesses and risks honestly.",
  },
  {
    key: "cert_05",
    label: "I confirm the field visits and meetings shown as attended by me are accurate.",
  },
];
