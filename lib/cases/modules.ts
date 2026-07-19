import type { IconName } from "@/components/icons";

/** The seven thematic case modules. */
export type CaseModule =
  | "health"
  | "maternal"
  | "entitlements"
  | "education"
  | "early_childhood"
  | "youth"
  | "women";

export type CasePriority = "urgent" | "high" | "medium" | "low";

export const PRIORITY_ORDER: CasePriority[] = ["urgent", "high", "medium", "low"];

export interface WorkflowStage {
  key: string;
  label: string;
}
export interface CaseField {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "yesno";
}
export interface ModuleDef {
  key: CaseModule;
  prefix: string; // caseId prefix, e.g. "HLT"
  title: string;
  short: string;
  icon: IconName;
  color: string; // tailwind text color for accents
  bar: string; // tailwind bg color
  subcategories: { key: string; label: string }[];
  workflow: WorkflowStage[]; // last stage is the closed/terminal stage
  fields: CaseField[]; // staff-editable case fields
}

const sub = (key: string, label: string) => ({ key, label });
const st = (key: string, label: string) => ({ key, label });
const fld = (key: string, label: string, type: CaseField["type"] = "text"): CaseField => ({
  key,
  label,
  type,
});

export const MODULES: Record<CaseModule, ModuleDef> = {
  health: {
    key: "health",
    prefix: "HLT",
    title: "Health Referral & Treatment",
    short: "Health",
    icon: "health",
    color: "text-rose-500",
    bar: "bg-rose-500",
    subcategories: [
      sub("urgent_referral", "Urgent medical referral"),
      sub("routine_referral", "Routine health referral"),
      sub("chronic_illness", "Chronic illness"),
      sub("child_health", "Child health"),
      sub("nutrition", "Nutrition"),
      sub("disability_health", "Disability-related support"),
      sub("other_health", "Other health need"),
    ],
    workflow: [
      st("identified", "Identified"),
      st("assigned", "Assigned"),
      st("contacted", "Household contacted"),
      st("referral_initiated", "Referral initiated"),
      st("facility_visited", "Facility visited"),
      st("service_received", "Service received"),
      st("closed", "Closed"),
    ],
    fields: [
      fld("facility_referred", "Facility referred to"),
      fld("asha_contacted", "ASHA/ANM contacted", "yesno"),
      fld("referral_date", "Referral date", "date"),
      fld("visit_date", "Visit date", "date"),
      fld("service_received", "Service received", "yesno"),
      fld("notes", "Notes", "textarea"),
    ],
  },
  maternal: {
    key: "maternal",
    prefix: "MAT",
    title: "Maternal Health & ICDS",
    short: "Maternal / ICDS",
    icon: "maternal",
    color: "text-violet-500",
    bar: "bg-violet-500",
    subcategories: [
      sub("pregnancy_registration", "Pregnancy registration"),
      sub("asha_linkage", "ASHA / ANM linkage"),
      sub("anc_checkup", "ANC check-up"),
      sub("institutional_delivery", "Institutional-delivery planning"),
      sub("high_priority_referral", "High-priority maternal referral"),
      sub("postnatal", "Postnatal follow-up"),
      sub("icds_linkage", "Anganwadi / ICDS linkage"),
      sub("thr_nutrition", "THR / nutrition support"),
    ],
    workflow: [
      st("identified", "Identified"),
      st("contacted", "Frontline worker contacted"),
      st("service_visit", "Service appointment / visit"),
      st("service_confirmed", "Service confirmed"),
      st("monitoring", "Continued monitoring"),
      st("closed", "Closed"),
    ],
    fields: [
      fld("frontline_worker", "ASHA / ANM / AWW"),
      fld("registration_done", "Registration done", "yesno"),
      fld("anc_visits", "ANC visits so far"),
      fld("delivery_place", "Planned delivery place"),
      fld("next_milestone_date", "Next milestone date", "date"),
      fld("notes", "Notes", "textarea"),
    ],
  },
  entitlements: {
    key: "entitlements",
    prefix: "ENT",
    title: "Social Security & Entitlements",
    short: "Entitlements",
    icon: "docs",
    color: "text-teal-500",
    bar: "bg-teal-500",
    subcategories: [
      sub("aadhaar", "Aadhaar"),
      sub("ration_pds", "Ration card / PDS"),
      sub("ayushman", "Ayushman card"),
      sub("birth_certificate", "Birth certificate"),
      sub("pension", "Pension"),
      sub("maternity_benefit", "Maternity benefits"),
      sub("bank_account", "Bank account"),
      sub("disability_certificate", "Disability certificate"),
      sub("other_documents", "Caste / income / residence & others"),
      sub("other_scheme", "Other government scheme"),
    ],
    workflow: [
      st("identified", "Need identified"),
      st("eligibility_checked", "Eligibility checked"),
      st("docs_collected", "Documents collected"),
      st("application_submitted", "Application submitted"),
      st("acknowledged", "Acknowledgement received"),
      st("approved", "Approved"),
      st("benefit_received", "Benefit / card received"),
      st("closed", "Closed"),
    ],
    fields: [
      fld("scheme_ref", "Application / reference no."),
      fld("submitted_date", "Application submitted date", "date"),
      fld("department", "Department / office"),
      fld("outcome", "Outcome (approved / rejected / pending)"),
      fld("received_date", "Benefit received date", "date"),
      fld("notes", "Notes", "textarea"),
    ],
  },
  education: {
    key: "education",
    prefix: "EDU",
    title: "Education & Out-of-School Children",
    short: "Education",
    icon: "education",
    color: "text-amber-500",
    bar: "bg-amber-500",
    subcategories: [
      sub("never_enrolled", "Never enrolled"),
      sub("dropped_out", "Dropped out"),
      sub("irregular", "Irregular attendance"),
      sub("not_attending", "Enrolled, not attending"),
      sub("admission_pending", "Admission pending"),
      sub("missing_documents", "Missing documents"),
      sub("retention", "Retention follow-up"),
    ],
    workflow: [
      st("identified", "Child identified"),
      st("family_counselled", "Family counselled"),
      st("docs_checked", "Documents checked"),
      st("school_contacted", "School contacted"),
      st("admission_initiated", "Admission initiated"),
      st("enrolled", "Child enrolled"),
      st("attendance_verified", "Attendance verified"),
      st("closed", "Closed (sustained attendance)"),
    ],
    fields: [
      fld("current_school", "Current / previous school"),
      fld("last_class", "Last class attended"),
      fld("family_willing", "Family willing", "yesno"),
      fld("admission_date", "Admission date", "date"),
      fld("enrolment_no", "Enrolment number"),
      fld("attendance_status", "Current attendance status"),
      fld("notes", "Notes", "textarea"),
    ],
  },
  early_childhood: {
    key: "early_childhood",
    prefix: "ECD",
    title: "Early Childhood & Anganwadi",
    short: "Early childhood",
    icon: "child",
    color: "text-sky-500",
    bar: "bg-sky-500",
    subcategories: [
      sub("anganwadi_registration", "Anganwadi registration"),
      sub("growth_monitoring", "Growth monitoring"),
      sub("immunisation", "Immunisation follow-up"),
      sub("nutrition", "Nutrition counselling"),
      sub("child_health", "Child-health referral"),
      sub("birth_registration", "Birth registration"),
      sub("caregiver_counselling", "Caregiver counselling"),
    ],
    workflow: [
      st("identified", "Child identified"),
      st("need_verified", "Need verified"),
      st("frontline_contacted", "AWW / ASHA / ANM contacted"),
      st("service_received", "Service received"),
      st("followup_verified", "Follow-up verified"),
      st("closed", "Closed"),
    ],
    fields: [
      fld("awc_name", "Anganwadi centre"),
      fld("frontline_worker", "AWW / ASHA / ANM"),
      fld("service_date", "Service date", "date"),
      fld("notes", "Notes", "textarea"),
    ],
  },
  youth: {
    key: "youth",
    prefix: "YTH",
    title: "Youth Group & Leadership",
    short: "Youth",
    icon: "youth",
    color: "text-indigo-500",
    bar: "bg-indigo-500",
    subcategories: [
      sub("interested", "Interested — awaiting contact"),
      sub("potential_leader", "Potential youth leader"),
      sub("group_member", "Youth group member"),
      sub("needs_followup", "Requires individual follow-up"),
    ],
    workflow: [
      st("identified", "Identified"),
      st("contacted", "Contacted"),
      st("interest_confirmed", "Interest confirmed"),
      st("assigned_group", "Assigned to group"),
      st("attended_meeting", "Attended first meeting"),
      st("active_member", "Active member"),
      st("closed", "Closed"),
    ],
    fields: [
      fld("group_name", "Group name / code"),
      fld("facilitator", "Facilitator"),
      fld("topics", "Topics of interest"),
      fld("preferred_time", "Preferred meeting time"),
      fld("notes", "Notes", "textarea"),
    ],
  },
  women: {
    key: "women",
    prefix: "WMN",
    title: "Women & Adolescent Girls",
    short: "Women & girls",
    icon: "women",
    color: "text-pink-500",
    bar: "bg-pink-500",
    subcategories: [
      sub("interested_women", "Interested women"),
      sub("interested_girls", "Interested adolescent girls"),
      sub("referral", "Referral from session"),
      sub("needs_session", "Awaiting session assignment"),
    ],
    workflow: [
      st("identified", "Interest identified"),
      st("contacted", "Contacted"),
      st("assigned_session", "Assigned to session / group"),
      st("participated", "Participated"),
      st("referral_created", "Referral created"),
      st("closed", "Closed"),
    ],
    fields: [
      fld("group_name", "Group / session"),
      fld("facilitator", "Facilitator"),
      fld("topics", "Preferred topics"),
      fld("safe_venue", "Safe venue"),
      fld("preferred_time", "Preferred time"),
      fld("notes", "Notes", "textarea"),
    ],
  },
};

export const MODULE_LIST: ModuleDef[] = [
  MODULES.health,
  MODULES.maternal,
  MODULES.entitlements,
  MODULES.education,
  MODULES.early_childhood,
  MODULES.youth,
  MODULES.women,
];

export function moduleDef(key: string): ModuleDef | undefined {
  return (MODULES as Record<string, ModuleDef>)[key];
}
export function firstStage(m: CaseModule): string {
  return MODULES[m].workflow[0].key;
}
export function closedStage(m: CaseModule): string {
  const wf = MODULES[m].workflow;
  return wf[wf.length - 1].key;
}
export function stageLabel(m: CaseModule, key: string): string {
  return MODULES[m].workflow.find((s) => s.key === key)?.label || key;
}
export function subcategoryLabel(m: CaseModule, key: string): string {
  return MODULES[m].subcategories.find((s) => s.key === key)?.label || key;
}
