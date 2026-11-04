import { MODULES, type CaseField, type CaseModule } from "@/lib/cases/modules";

/**
 * The "Community Support & Follow-up" form.
 *
 * Page 1 is the same for everyone (date, community, referral, beneficiary,
 * phone). The REFERRAL chosen decides page 2 — what kind of support and which
 * extra questions are asked — then every referral ends with the same proof
 * photo / status / remarks questions. Referral = one of the app's case
 * modules, so a CM closing a case lands on the right page automatically.
 *
 * The "Document Support" page is exactly the old Google Sheet's columns.
 * The other pages are built from each module's own case fields; they can be
 * reshaped here once the original form's other pages are known.
 */
export interface Referral {
  key: CaseModule;
  label: string;
  hi: string;
}

export const REFERRALS: Referral[] = [
  { key: "entitlements", label: "Document Support", hi: "दस्तावेज़ सहायता" },
  { key: "health", label: "Health", hi: "स्वास्थ्य" },
  { key: "maternal", label: "Maternal & ICDS", hi: "मातृ स्वास्थ्य / ICDS" },
  { key: "education", label: "Education", hi: "शिक्षा" },
  { key: "early_childhood", label: "Early childhood", hi: "प्रारंभिक बाल्यावस्था" },
  { key: "youth", label: "Youth", hi: "युवा" },
  { key: "women", label: "Women & girls", hi: "महिला एवं किशोरी" },
];

export const REFERRAL_BY_KEY: Record<string, Referral> = Object.fromEntries(
  REFERRALS.map((r) => [r.key, r])
);

export interface SupportType {
  key: string;
  label: string;
  /** Case subcategory this support belongs to. */
  subcategory: string;
  /** For certificates: the document key a case lists in `meta.docs`. */
  doc?: string;
}

/** Document Support page: what the sheet calls "Type of Support". */
const DOCUMENT_TYPES: SupportType[] = [
  { key: "residence_certificate", label: "Residence Certificate", subcategory: "other_documents", doc: "residence_cert" },
  { key: "income_certificate", label: "Income Certificate", subcategory: "other_documents", doc: "income_cert" },
  { key: "caste_certificate", label: "Caste Certificate", subcategory: "other_documents", doc: "caste_cert" },
  { key: "ayushman_card", label: "Ayushman Card", subcategory: "ayushman" },
  { key: "bank_account", label: "Bank Account", subcategory: "bank_account" },
  { key: "aadhaar_card", label: "Aadhaar Card", subcategory: "aadhaar" },
  { key: "ration_card", label: "Ration Card", subcategory: "ration_pds" },
  { key: "voter_id", label: "Voter ID", subcategory: "other_documents", doc: "voter_id" },
  { key: "birth_certificate", label: "Birth Certificate", subcategory: "birth_certificate" },
  { key: "pension", label: "Pension", subcategory: "pension" },
  { key: "disability_certificate", label: "Disability Certificate", subcategory: "disability_certificate" },
  { key: "other_scheme", label: "Other scheme / document", subcategory: "other_scheme" },
];

/** What can be chosen as "Type of support" on the page for this referral. */
export function supportTypesFor(referral: string): SupportType[] {
  if (referral === "entitlements") return DOCUMENT_TYPES;
  const m = MODULES[referral as CaseModule];
  if (!m) return [];
  return m.subcategories.map((s) => ({ key: s.key, label: s.label, subcategory: s.key }));
}

/** The referral-specific questions after "type of support" (the module's own case fields). */
export function detailFields(referral: string): CaseField[] {
  const m = MODULES[referral as CaseModule];
  if (!m) return [];
  return m.fields.filter((f) => f.key !== "notes");
}

export const STATUSES = [
  { key: "complete", label: "Complete", hi: "पूरा" },
  { key: "follow_up_required", label: "Follow-up required", hi: "फॉलो-अप ज़रूरी" },
] as const;

/**
 * Turn the sheet's free-typed "Type of Support" into type keys:
 * "Caste Certificate, Residence Certificate," → [caste_certificate, residence_certificate];
 * tolerates "Cast Certificate", double spaces and trailing commas.
 */
export function parseDocumentTypes(text: string): { keys: string[]; unknown: string[] } {
  const keys: string[] = [];
  const unknown: string[] = [];
  for (const raw of text.split(/[,;\n]+/)) {
    const t = raw.toLowerCase().replace(/\s+/g, " ").trim();
    if (!t) continue;
    const hit = DOCUMENT_TYPES.find(
      (d) =>
        d.label.toLowerCase() === t ||
        t.replace(/^cast\b/, "caste") === d.label.toLowerCase() ||
        t.replace(/\s*certificate$/, "") === d.label.toLowerCase().replace(/\s*certificate$/, "")
    );
    if (hit) {
      if (!keys.includes(hit.key)) keys.push(hit.key);
    } else unknown.push(raw.trim());
  }
  return { keys, unknown };
}

/** Which "type of support" boxes to pre-tick when the form is opened from a case. */
export function presetTypesForCase(module: string, subcategory: string, metaDocs?: unknown): string[] {
  const types = supportTypesFor(module);
  if (module !== "entitlements") return types.some((t) => t.key === subcategory) ? [subcategory] : [];
  if (subcategory === "other_documents") {
    const docs = Array.isArray(metaDocs) ? (metaDocs as string[]) : [];
    const keys = types.filter((t) => t.doc && docs.includes(t.doc)).map((t) => t.key);
    return keys;
  }
  const hit = types.find((t) => t.subcategory === subcategory);
  return hit ? [hit.key] : [];
}

export function typeLabels(referral: string, keys: string[]): string[] {
  const all = supportTypesFor(referral);
  return keys.map((k) => all.find((t) => t.key === k)?.label ?? k);
}
