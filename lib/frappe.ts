import { ObjectId } from "mongodb";
import { surveysCol, type SurveyDoc, type SyncState } from "./models";
import { SETTLEMENT_BY_CODE } from "./questionnaire/settlements";
import { settlementLabels } from "./settlements";

/**
 * Frappe sync client.
 *
 * MongoDB is our source of truth. Only the funder-required subset of each
 * household record is pushed to Frappe (`Household Detail` DocType). Pushes
 * are best-effort and never block the mobiliser: failures leave the record
 * `sync.status = "failed"` so the Director dashboard can re-sync later.
 */

function baseUrl(): string {
  const url = process.env.FRAPPE_BASE_URL;
  if (!url) throw new Error("FRAPPE_BASE_URL is not set");
  return url.replace(/\/$/, "");
}

function doctype(): string {
  return process.env.FRAPPE_HOUSEHOLD_DOCTYPE || "Household Detail";
}

/** True when enough config exists to attempt a sync. */
export function frappeConfigured(): boolean {
  const hasToken =
    !!process.env.FRAPPE_API_KEY && !!process.env.FRAPPE_API_SECRET;
  const hasLogin = !!process.env.FRAPPE_USR && !!process.env.FRAPPE_PWD;
  return !!process.env.FRAPPE_BASE_URL && (hasToken || hasLogin);
}

/* ── Auth: token (preferred) or session-cookie fallback ─────── */
let cachedCookie: string | null = null;

async function login(): Promise<string> {
  if (cachedCookie) return cachedCookie;
  const res = await fetch(`${baseUrl()}/api/method/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      usr: process.env.FRAPPE_USR,
      pwd: process.env.FRAPPE_PWD,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      `Frappe login failed (${res.status})${detail ? `: ${detail.slice(0, 160)}` : ""}`
    );
  }

  // Collect Set-Cookie values. Node/undici exposes getSetCookie() which
  // correctly returns each cookie separately (a plain get() joins them and
  // breaks on commas inside Expires dates).
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const raw =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : ([res.headers.get("set-cookie")].filter(Boolean) as string[]);

  const pairs = raw
    .map((c) => c.split(";")[0].trim())
    .filter((c) => c.includes("="));
  if (pairs.length === 0) {
    throw new Error("Frappe login returned no session cookie");
  }
  cachedCookie = pairs.join("; ");
  return cachedCookie;
}

async function authHeaders(): Promise<Record<string, string>> {
  const key = process.env.FRAPPE_API_KEY;
  const secret = process.env.FRAPPE_API_SECRET;
  if (key && secret) {
    return { Authorization: `token ${key}:${secret}` };
  }
  const cookie = await login();
  return { Cookie: cookie };
}

async function frappeRequest(
  path: string,
  init: RequestInit & { retryAuth?: boolean } = {}
): Promise<unknown> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...(await authHeaders()),
    ...((init.headers as Record<string, string>) || {}),
  };

  const res = await fetch(`${baseUrl()}${path}`, { ...init, headers });

  // Session expired → drop cached cookie and retry once.
  if ((res.status === 401 || res.status === 403) && init.retryAuth !== false) {
    cachedCookie = null;
    return frappeRequest(path, { ...init, retryAuth: false });
  }

  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const message =
      (body as { exception?: string; _server_messages?: string })?.exception ||
      (typeof body === "string" ? body : `Frappe error ${res.status}`);
    throw new Error(String(message).slice(0, 500));
  }
  return body;
}

/* ── Field mapping: our survey → Frappe ─────────────────────────
 * The funder's `Household Detail` doctype exposes 80 fields and `Family
 * Member` another 50. Everything below is filled from answers the survey
 * already collects; anything we do not ask is simply left out, so a blank is
 * never written over a value entered on the funder's side.
 * The FIELD_MAP table is also what the Frappe sync screen renders, so the
 * mapping shown in the app can never drift from the mapping actually sent.
 * ─────────────────────────────────────────────────────────────── */

/** Translate one of our option codes into the words the funder's sheet uses. */
const pick = (map: Record<string, string>) => (v: unknown): string | undefined =>
  map[String(v ?? "")] ?? undefined;

const YES_NO = { yes: "Yes", no: "No" };

/** survey field → { frappe field, how to convert } */
export interface FrappeFieldMap {
  /** Field name on the Frappe doctype. */
  frappe: string;
  /** Our questionnaire field it comes from ("—" when derived). */
  source: string;
  /** Human description for the sync screen. */
  label: string;
  value: (d: Record<string, unknown>, survey: SurveyDoc, area: string) => unknown;
}

export const HOUSEHOLD_FIELD_MAP: FrappeFieldMap[] = [
  { frappe: "user_fullname", source: "respondent_name", label: "Respondent name",
    value: (d) => (d.respondent_name as string) || (d.head_name as string) || "" },
  { frappe: "surveyor_name", source: "mobiliser_name", label: "Surveyor",
    value: (d, s) => (d.mobiliser_name as string) || s.mobiliserCode || "" },
  { frappe: "date", source: "survey_date", label: "Survey date",
    value: (d) => (d.survey_date as string) || null },
  { frappe: "household_head_name", source: "head_name", label: "Household head",
    value: (d) => (d.head_name as string) || "" },
  { frappe: "total_family_members", source: "hh_total_members", label: "Family size",
    value: (d) => toInt(d.hh_total_members) ?? 0 },
  { frappe: "area", source: "settlement_name", label: "Community / area",
    value: (_d, _s, area) => area },
  { frappe: "address", source: "household_landmark + ward_number", label: "Address with ward",
    value: (d, _s, area) =>
      [d.household_landmark, d.ward_number ? `Ward ${d.ward_number}` : ""]
        .filter(Boolean)
        .join(", ") || area },
  { frappe: "household_income", source: "monthly_income_range", label: "Monthly income",
    value: (d) => incomeFromRange(d.monthly_income_range as string | undefined) },

  // Values below must match the funder's dropdowns exactly, or Frappe rejects
  // the whole record. EBC and Minority have no option there, so they go to
  // "Other" rather than failing the push.
  { frappe: "caste", source: "social_group", label: "Social group / caste",
    value: (d) => pick({ sc: "SC", st: "ST", obc: "OBC", general: "General",
      ebc: "Other", minority: "Other", other: "Other" })(d.social_group) },
  { frappe: "type_of_house", source: "housing_type", label: "Type of house",
    value: (d) => pick({ kaccha: "Kutcha", pucca: "Pacca",
      semi_pucca: "Semi pacca" })(d.housing_type) },
  { frappe: "type_of_toilet", source: "toilet_access", label: "Type of toilet",
    value: (d) => pick({ own: "Intrahousehold Toilet",
      shared: "Shared Toilet (from Neighbor)", open: "Open Defecation",
      paid: "Public Toilet" })(d.toilet_access) },
  { frappe: "areyou_migrated", source: "migration_status", label: "Migration",
    value: (d) => pick({ no: "No", seasonal: "Yes", one_or_more: "Yes",
      whole_family_moves: "Yes" })(d.migration_status) },
  { frappe: "source_of_electricity", source: "electricity_access", label: "Electricity source",
    value: (d) => pick({ no: "None", regular: "Other", irregular: "Other",
      shared: "Other", other: "Other" })(d.electricity_access) },
  { frappe: "getting_ration", source: "has_ration_card + ration_card_issue", label: "Getting ration",
    value: (d) => {
      const v = d.has_ration_card;
      if (v === undefined || v === "") return undefined;
      const issues = Array.isArray(d.ration_card_issue) ? (d.ration_card_issue as string[]) : [];
      if (issues.includes("not_getting_ration")) return "No";
      return v === "yes" ? "Yes" : "No";
    } },

  /* Not mapped on purpose — the funder's dropdown asks something our
   * questionnaire does not, so filling it would mean inventing an answer:
   *   rationcard_type        APL / BPL / None        (we only ask yes/no)
   *   water_supply           source of supply        (we ask about problems)
   *   water_timing           hours of supply         (not asked)
   *   garbage_collection     collection frequency    (we ask yes/no/sometimes)
   *   drainage_connection    type of connection      (we ask severity)
   *   public_toilet          distance to it          (not asked)
   *   summer_issues          not asked
   *   monsoon_issues         not asked
   *   cookingfuel_type, free_electricity, no_of_rooms, light_bill, tax_bill,
   *   other_property, family_income_certificate, outstanding_loan,
   *   death_3years          all not asked yet
   * Adding those questions is what fills the rest of the funder's sheet. */
];

export function mapSurveyToFrappe(
  survey: SurveyDoc,
  areaLabel?: string
): Record<string, unknown> {
  const d = survey.data || {};
  const area =
    areaLabel ?? SETTLEMENT_BY_CODE[survey.settlementCode]?.label ?? survey.settlementCode;

  const payload: Record<string, unknown> = { doctype: doctype() };
  for (const f of HOUSEHOLD_FIELD_MAP) {
    const v = f.value(d, survey, area);
    if (v !== null && v !== undefined && v !== "") payload[f.frappe] = v;
  }
  return payload;
}

/* ── Family Member records ──────────────────────────────────── */

export const MEMBER_FIELD_MAP: FrappeFieldMap[] = [
  { frappe: "full_name", source: "member_name", label: "Full name",
    value: (m) => (m.member_name as string) || "" },
  { frappe: "first_name", source: "member_name", label: "First name",
    value: (m) => String(m.member_name || "").trim().split(/\s+/)[0] || "" },
  { frappe: "last_name", source: "member_name", label: "Last name",
    value: (m) => String(m.member_name || "").trim().split(/\s+/).slice(1).join(" ") || undefined },
  { frappe: "gender", source: "member_gender", label: "Gender",
    value: (m) => pick({ female: "Female", male: "Male", other: "Other" })(m.member_gender) },
  { frappe: "age", source: "member_age", label: "Age",
    value: (m) => {
      const n = Number(m.member_age);
      return Number.isFinite(n) ? Math.floor(n) : undefined;
    } },
  { frappe: "marital_status", source: "member_marital_status", label: "Marital status",
    value: (m) => pick({ unmarried: "Unmarried", married: "Married", widow: "Widow",
      separated: "Seperated", divorced: "Divorcee" })(m.member_marital_status) },
  { frappe: "education", source: "member_highest_qual_25 / _19_24", label: "Education level",
    value: (m) => pick({
      never_school: "Illiterate", can_sign: "Illiterate",
      primary: "Primary(1st - 7th Standard)", middle: "High School (8th-10th)",
      matric: "High School (8th-10th)", inter: "Higher Secondary (11th-12th Std)",
      iti: "Certified Training/Course", diploma: "Certified Training/Course",
      graduate: "Graduate", postgraduate: "Post Graduate",
    })(m.member_highest_qual_25 ?? m.member_highest_qual_19_24) },
  { frappe: "education_status", source: "member_school_status_6_18", label: "Education status",
    value: (m) => pick({ in_school: "Education is Ongoing", dropout: "Dropout",
      open_school: "Education is Ongoing", madarsa: "Education is Ongoing" })(
      m.member_school_status_6_18) },
  { frappe: "unemployment_reason", source: "member_work_status", label: "Not working because",
    value: (m) => pick({ student: "Student", housework: "Housewife",
      unemployed: "Unemployed – has no skill" })(m.member_work_status) },
  { frappe: "disability_card", source: "member_disability", label: "Disability certificate",
    value: (m) => pick({ yes_cert: "Yes", yes_no_cert: "No" })(m.member_disability) },
  { frappe: "any_disability", source: "member_disability", label: "Disability",
    // Only "no" is safe: the funder wants the type of disability, which we
    // do not ask, so a "yes" is left for them rather than guessed.
    value: (m) => (m.member_disability === "no" ? "None" : undefined) },
];

/** One Frappe `Family Member` payload per household member. */
export function mapMemberToFrappe(
  member: Record<string, unknown>,
  survey: SurveyDoc,
  hhid: string,
  areaLabel?: string
): Record<string, unknown> {
  const d = survey.data || {};
  const area =
    areaLabel ?? SETTLEMENT_BY_CODE[survey.settlementCode]?.label ?? survey.settlementCode;

  const payload: Record<string, unknown> = {
    doctype: "Family Member",
    hhid,
    household_head_name: (d.head_name as string) || "",
    area,
    name_of_the_subsettlement: (d.household_landmark as string) || area,
    surveyor_name: (d.mobiliser_name as string) || survey.mobiliserCode || "",
  };
  for (const f of MEMBER_FIELD_MAP) {
    const v = f.value(member, survey, area);
    if (v !== null && v !== undefined && v !== "") payload[f.frappe] = v;
  }
  return payload;
}

function toInt(v: unknown): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

/** We collect income as a band; Frappe wants a number, so use a band midpoint. */
function incomeFromRange(code?: string): number {
  switch (code) {
    case "less_5000":
      return 3000;
    case "5000_10000":
      return 7500;
    case "10001_15000":
      return 12500;
    case "15001_25000":
      return 20000;
    case "more_25000":
      return 30000;
    default:
      return 0;
  }
}

/* ── Push (create or update) ────────────────────────────────── */
interface PushResult {
  ok: boolean;
  frappeId?: string;
  error?: string;
  /** How many Family Member records went across with the household. */
  members?: { synced: number; failed: number };
}

const MEMBER_DOCTYPE = "Family Member";

/**
 * Push the household's members as Frappe `Family Member` records.
 * Matched on household id + full name so a re-sync updates rather than
 * duplicates. Best-effort: a member that fails never fails the household.
 */
async function pushMembersToFrappe(
  survey: SurveyDoc,
  hhid: string,
  areaLabel?: string
): Promise<{ synced: number; failed: number }> {
  const members = (survey.members || []) as Record<string, unknown>[];
  let synced = 0;
  let failed = 0;

  // What is already on Frappe for this household, so re-syncs update in place.
  const existing = new Map<string, string>();
  try {
    const q = `/api/resource/${encodeURIComponent(MEMBER_DOCTYPE)}` +
      `?filters=${encodeURIComponent(JSON.stringify([["hhid", "=", hhid]]))}` +
      `&fields=${encodeURIComponent(JSON.stringify(["name", "full_name"]))}` +
      `&limit_page_length=200`;
    const res = (await frappeRequest(q)) as { data?: { name: string; full_name?: string }[] };
    for (const row of res?.data || []) {
      if (row.full_name) existing.set(row.full_name.trim().toLowerCase(), row.name);
    }
  } catch {
    /* listing is only an optimisation — fall through and create */
  }

  for (const m of members) {
    const name = String(m.member_name || "").trim();
    if (!name) continue; // a blank roster row is not a person
    const payload = mapMemberToFrappe(m, survey, hhid, areaLabel);
    const already = existing.get(name.toLowerCase());
    try {
      if (already) {
        await frappeRequest(
          `/api/resource/${encodeURIComponent(MEMBER_DOCTYPE)}/${encodeURIComponent(already)}`,
          { method: "PUT", body: JSON.stringify(payload) }
        );
      } else {
        await frappeRequest(`/api/resource/${encodeURIComponent(MEMBER_DOCTYPE)}`, {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      synced++;
    } catch {
      failed++;
    }
  }
  return { synced, failed };
}

export async function pushSurveyToFrappe(
  survey: SurveyDoc,
  areaLabel?: string
): Promise<PushResult> {
  if (!frappeConfigured()) {
    return { ok: false, error: "Frappe is not configured (check .env.local)" };
  }
  const payload = mapSurveyToFrappe(survey, areaLabel);
  try {
    let frappeId = survey.sync?.frappeId;
    if (frappeId) {
      // Update the existing doc (idempotent re-sync).
      await frappeRequest(
        `/api/resource/${encodeURIComponent(doctype())}/${encodeURIComponent(frappeId)}`,
        { method: "PUT", body: JSON.stringify(payload) }
      );
    } else {
      const res = (await frappeRequest(
        `/api/resource/${encodeURIComponent(doctype())}`,
        { method: "POST", body: JSON.stringify(payload) }
      )) as { data?: { name?: string } };
      frappeId = res?.data?.name;
    }

    // Household members go to their own doctype; never block the household.
    let members: PushResult["members"];
    if (frappeId) {
      members = await pushMembersToFrappe(survey, frappeId, areaLabel);
    }
    return { ok: true, frappeId, members };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Sync failed" };
  }
}

/* ── Sync one survey by id + persist sync state ─────────────── */
export async function syncSurveyById(
  id: string | ObjectId
): Promise<SyncState> {
  const surveys = await surveysCol();
  const _id = typeof id === "string" ? new ObjectId(id) : id;
  const survey = await surveys.findOne({ _id });
  if (!survey) throw new Error("Survey not found");

  // Incomplete surveys never leave Mongo — sync only after completion.
  if (survey.status !== "complete") {
    return survey.sync ?? { status: "pending", attempts: 0 };
  }

  // Use the community's current name, not the seed list.
  let areaLabel: string | undefined;
  try {
    const labels = await settlementLabels();
    areaLabel = labels[survey.settlementCode];
  } catch {
    /* fall back to the seed label inside the mapper */
  }
  const result = await pushSurveyToFrappe(survey, areaLabel);
  const now = new Date();
  const attempts = (survey.sync?.attempts || 0) + 1;

  const sync: SyncState = result.ok
    ? {
        status: "synced",
        frappeId: result.frappeId || survey.sync?.frappeId,
        members: result.members,
        attempts,
        lastAttemptAt: now,
        syncedAt: now,
      }
    : {
        status: "failed",
        frappeId: survey.sync?.frappeId,
        attempts,
        lastAttemptAt: now,
        error: result.error,
      };

  await surveys.updateOne({ _id }, { $set: { sync, updatedAt: now } });
  return sync;
}
