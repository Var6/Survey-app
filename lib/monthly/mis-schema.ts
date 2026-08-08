import type { Section, Option, Field } from "@/lib/questionnaire";

/**
 * Supervisor cum MIS Assistant monthly report (MISM module).
 * Submitted to the Programme Manager by the 5th of every month.
 */

const o = (code: string, en: string): Option => ({ code, en, hi: en });
const yesno = (): Option[] => [o("yes", "Yes"), o("no", "No")];

const text = (qid: string, name: string, en: string, required = false): Field => ({
  qid,
  name,
  label: { en },
  type: "textarea",
  required,
});
const num = (qid: string, name: string, en: string): Field => ({
  qid,
  name,
  label: { en },
  type: "integer",
  validation: { min: 0, max: 99999 },
});

export const MIS_MONTHLY_SECTIONS: Section[] = [
  {
    id: "A",
    title: { en: "Data collection & entry status" },
    items: [
      num("MISM-A01", "forms_received", "Household profiling / activity forms received this month"),
      num("MISM-A02", "forms_entered", "Forms entered into the system this month"),
      text("MISM-A03", "entry_backlog", "Backlog remaining, with reason"),
      {
        qid: "MISM-A04",
        name: "entry_on_time",
        label: { en: "Was data entry completed within the timeline?" },
        type: "select",
        options: yesno(),
        required: true,
      },
      {
        ...text("MISM-A05", "entry_delay_reason", "If no, why?"),
        showWhen: { field: "entry_on_time", eq: "no" },
      },
    ],
  },
  {
    id: "B",
    title: { en: "Database & tracker updates" },
    items: [
      text(
        "MISM-B01",
        "trackers_updated",
        "Trackers updated this month (household profiling, youth groups, children/school enrolment, entitlement applications, health referrals)",
        true
      ),
      text(
        "MISM-B02",
        "cumulative_totals",
        "Cumulative totals updated this month (HHs profiled, youth in groups, OOS children enrolled, entitlements secured, referrals made)"
      ),
    ],
  },
  {
    id: "C",
    title: { en: "Data quality & verification" },
    items: [
      text(
        "MISM-C01",
        "spot_checks",
        "Cross-verification / spot-checks conducted this month (number of records, method used)",
        true
      ),
      text("MISM-C02", "discrepancies", "Data discrepancies found (type and count)"),
      text("MISM-C03", "corrections_made", "Corrections made this month"),
    ],
  },
  {
    id: "D",
    title: { en: "Field–MIS coordination" },
    items: [
      text(
        "MISM-D01",
        "mobilisers_supported",
        "Mobilisers supported with formats / data collection / troubleshooting this month"
      ),
      text("MISM-D02", "common_errors", "Common errors observed in field data (up to three)"),
      text("MISM-D03", "feedback_given", "Feedback given to mobilisers"),
    ],
  },
  {
    id: "E",
    title: { en: "Monthly data review with Programme Manager" },
    items: [
      {
        qid: "MISM-E01",
        name: "data_review_done",
        label: { en: "Was the monthly data review conducted with the PM?" },
        type: "select",
        options: yesno(),
        required: true,
      },
      {
        qid: "MISM-E02",
        name: "data_review_date",
        label: { en: "Date of the review" },
        type: "date",
        showWhen: { field: "data_review_done", eq: "yes" },
      },
      text("MISM-E03", "review_findings", "Key data findings shared"),
      text("MISM-E04", "review_actions", "Follow-up actions agreed"),
    ],
  },
  {
    id: "F",
    title: { en: "Reporting & dashboard" },
    items: [
      {
        qid: "MISM-F01",
        name: "dashboard_shared",
        label: { en: "Monthly report / dashboard prepared and shared?" },
        type: "select",
        options: yesno(),
      },
      text("MISM-F02", "dashboard_details", "Date shared and with whom"),
      text("MISM-F03", "key_metrics", "Key metrics highlighted this month, against targets"),
    ],
  },
  {
    id: "G",
    title: { en: "Documentation & evidence repository" },
    items: [
      text(
        "MISM-G01",
        "evidence_filed",
        "Photographs, consent forms and attendance sheets collected and filed this month"
      ),
      text("MISM-G02", "case_stories", "Case stories documented this month"),
      text("MISM-G03", "missing_documentation", "Missing or incomplete documentation flagged"),
    ],
  },
  {
    id: "H",
    title: { en: "Risks & support needed" },
    items: [
      text("MISM-H01", "data_risks", "Data or system risks / concerns"),
      text("MISM-H02", "support_required", "Support or decision required from PM / Director"),
    ],
  },
  {
    id: "I",
    title: { en: "Next-month plan" },
    items: [
      text(
        "MISM-I01",
        "next_month_priorities",
        "Data / MIS priorities for next month — settlement, target/activity, owner and deadline",
        true
      ),
    ],
  },
];

export const MIS_MONTHLY_CERTIFICATION: { key: string; label: string }[] = [
  {
    key: "cert_01",
    label: "The entry, backlog and verification figures above match the system records.",
  },
  {
    key: "cert_02",
    label: "I have disclosed all known data gaps, discrepancies and pending documentation.",
  },
];

export const MIS_MONTHLY_REQUIRED: { field: string; message: string }[] = [
  { field: "entry_on_time", message: "Data-entry timeliness (Section A) is required." },
  { field: "trackers_updated", message: "Trackers updated (Section B) is required." },
  { field: "spot_checks", message: "Cross-verification / spot-checks (Section C) are required." },
  { field: "data_review_done", message: "Monthly data review with the PM (Section E) is required." },
  { field: "next_month_priorities", message: "Next-month MIS priorities (Section I) are required." },
];
