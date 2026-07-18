import { ObjectId } from "mongodb";
import { surveysCol, type SurveyDoc, type SyncState } from "./models";
import { SETTLEMENT_BY_CODE } from "./questionnaire/settlements";

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

/* ── Field mapping: our survey → Frappe `Household Detail` ─────── *
 * These are exactly the fields the funder's DocType exposes (per the working
 * create test). Only this subset is pushed; everything else stays in Mongo. */
export function mapSurveyToFrappe(survey: SurveyDoc): Record<string, unknown> {
  const d = survey.data || {};
  const settlement = SETTLEMENT_BY_CODE[survey.settlementCode];
  const area = settlement?.label ?? survey.settlementCode;

  const payload: Record<string, unknown> = {
    doctype: doctype(),
    user_fullname: (d.respondent_name as string) || (d.head_name as string) || "",
    surveyor_name: (d.mobiliser_name as string) || survey.mobiliserCode || "",
    date: (d.survey_date as string) || null,
    household_head_name: (d.head_name as string) || "",
    total_family_members: toInt(d.hh_total_members) ?? 0,
    address: (d.household_landmark as string) || area,
    area,
    household_income: incomeFromRange(d.monthly_income_range as string | undefined),
  };

  // Drop null keys so we never overwrite Frappe fields with blanks.
  for (const k of Object.keys(payload)) {
    if (payload[k] === null || payload[k] === undefined) delete payload[k];
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
}

export async function pushSurveyToFrappe(survey: SurveyDoc): Promise<PushResult> {
  if (!frappeConfigured()) {
    return { ok: false, error: "Frappe is not configured (check .env.local)" };
  }
  const payload = mapSurveyToFrappe(survey);
  try {
    if (survey.sync?.frappeId) {
      // Update the existing doc (idempotent re-sync).
      const name = encodeURIComponent(survey.sync.frappeId);
      await frappeRequest(`/api/resource/${encodeURIComponent(doctype())}/${name}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      return { ok: true, frappeId: survey.sync.frappeId };
    }
    const res = (await frappeRequest(
      `/api/resource/${encodeURIComponent(doctype())}`,
      { method: "POST", body: JSON.stringify(payload) }
    )) as { data?: { name?: string } };
    const frappeId = res?.data?.name;
    return { ok: true, frappeId };
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

  const result = await pushSurveyToFrappe(survey);
  const now = new Date();
  const attempts = (survey.sync?.attempts || 0) + 1;

  const sync: SyncState = result.ok
    ? {
        status: "synced",
        frappeId: result.frappeId || survey.sync?.frappeId,
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
