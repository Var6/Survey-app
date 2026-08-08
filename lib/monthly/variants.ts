import type { Section } from "@/lib/questionnaire";
import type { Role } from "@/lib/models";
import { MONTHLY_SECTIONS, MONTHLY_CERTIFICATION } from "./schema";
import {
  CM_MONTHLY_SECTIONS,
  CM_MONTHLY_CERTIFICATION,
  CM_MONTHLY_REQUIRED,
} from "./cm-schema";
import {
  MIS_MONTHLY_SECTIONS,
  MIS_MONTHLY_CERTIFICATION,
  MIS_MONTHLY_REQUIRED,
} from "./mis-schema";

/**
 * The three monthly report variants share one collection, one form and one
 * review workflow — they differ only in questions, id prefix, who reviews
 * them, and what must be filled before submitting.
 */
export type MonthlyVariantKey = "pm" | "cm" | "mis";

export interface MonthlyVariant {
  key: MonthlyVariantKey;
  /** Author role that owns this variant. */
  authorRole: Role;
  /** Role that approves / returns it. */
  reviewerRole: Role;
  /** Report id prefix, e.g. PMM-2026-08. */
  prefix: string;
  title: string;
  /** Shown under the page title. */
  subtitle: string;
  /** Day of the following month the report is due. */
  dueDay: number;
  sections: Section[];
  certification: { key: string; label: string }[];
  required: { field: string; message: string }[];
  /** Settlement traffic-light table (Programme Manager only). */
  hasSettlementControl: boolean;
  /** Hindi-first labels in the form UI. */
  lang: "hi" | "en";
}

const PM_REQUIRED: { field: string; message: string }[] = [
  { field: "overall_status", message: "Overall project status (Section A) is required." },
  { field: "achievements", message: "Three achievements (Section A) are required." },
  { field: "gaps", message: "Three gaps or delays (Section A) are required." },
  {
    field: "baseline_by_settlement",
    message: "Baseline status per settlement (Section B) is required.",
  },
  { field: "oos_identified", message: "Out-of-school children identified (Section C) is required." },
  {
    field: "enrolment_supported",
    message: "Children supported for enrolment (Section C) is required.",
  },
  { field: "next_month_priorities", message: "Next-month priorities (Section J) are required." },
];

export const MONTHLY_VARIANTS: Record<MonthlyVariantKey, MonthlyVariant> = {
  pm: {
    key: "pm",
    authorRole: "programme_manager",
    reviewerRole: "director",
    prefix: "PMM",
    title: "Monthly report",
    subtitle: "Auto monthly dashboard, then your accountability sections",
    dueDay: 5,
    sections: MONTHLY_SECTIONS,
    certification: MONTHLY_CERTIFICATION,
    required: PM_REQUIRED,
    hasSettlementControl: true,
    lang: "en",
  },
  cm: {
    key: "cm",
    authorRole: "cm",
    reviewerRole: "programme_manager",
    prefix: "CMM",
    title: "मासिक रिपोर्ट / Monthly report",
    subtitle: "ऊपर की संख्याएँ ऐप से अपने-आप भरी हैं — नीचे केवल विवरण लिखें।",
    dueDay: 3,
    sections: CM_MONTHLY_SECTIONS,
    certification: CM_MONTHLY_CERTIFICATION,
    required: CM_MONTHLY_REQUIRED,
    hasSettlementControl: false,
    lang: "hi",
  },
  mis: {
    key: "mis",
    authorRole: "mis",
    reviewerRole: "programme_manager",
    prefix: "MISM",
    title: "Monthly report",
    subtitle: "Supervisor cum MIS Assistant — data, quality and evidence",
    dueDay: 5,
    sections: MIS_MONTHLY_SECTIONS,
    certification: MIS_MONTHLY_CERTIFICATION,
    required: MIS_MONTHLY_REQUIRED,
    hasSettlementControl: false,
    lang: "en",
  },
};

/** Which variant a user writes. Legacy docs (no authorRole) are PM reports. */
export function variantForRole(role: Role): MonthlyVariant | null {
  if (role === "programme_manager") return MONTHLY_VARIANTS.pm;
  if (role === "cm") return MONTHLY_VARIANTS.cm;
  if (role === "mis") return MONTHLY_VARIANTS.mis;
  return null;
}

export function variantForAuthorRole(role: Role | undefined): MonthlyVariant {
  return variantForRole(role || "programme_manager") ?? MONTHLY_VARIANTS.pm;
}

/** Report id for a month. CM reports are per-mobiliser, so they carry a suffix. */
export function monthlyReportId(
  variant: MonthlyVariant,
  year: number,
  month: number,
  suffix?: string
): string {
  const base = `${variant.prefix}-${year}-${String(month).padStart(2, "0")}`;
  return suffix ? `${base}-${suffix}` : base;
}
