import { importPKCS8, SignJWT } from "jose";
import { ObjectId } from "mongodb";
import { calendarLogCol, campsCol, type CampDoc, type CalendarState } from "./models";

/**
 * Google Calendar sync for camps.
 *
 * Auth is a Google service account (server-to-server), so no person has to
 * stay signed in and no token ever reaches the browser. One-time setup:
 *   1. Google Cloud → create a service account, enable the Google Calendar API,
 *      download its JSON key.
 *   2. In Google Calendar, share the programme calendar with the service
 *      account's email, permission "Make changes to events".
 *   3. Set on the server:
 *        GOOGLE_CALENDAR_ID                  the calendar's ID
 *        GOOGLE_SERVICE_ACCOUNT_EMAIL        client_email from the key
 *        GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY  private_key from the key (\n as \\n is fine)
 *
 * Duplicates are impossible by construction: every camp uses its own Mongo id
 * as the Google event id, so a retry updates the same event.
 */

const SCOPE = "https://www.googleapis.com/auth/calendar.events";
const apiBase = () => process.env.GOOGLE_CALENDAR_API_BASE || "https://www.googleapis.com/calendar/v3";
const tokenUrl = () => process.env.GOOGLE_OAUTH_TOKEN_URL || "https://oauth2.googleapis.com/token";
const TZ = "Asia/Kolkata";

export function gcalConfigured(): boolean {
  return !!(
    process.env.GOOGLE_CALENDAR_ID &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
}

let cached: { token: string; exp: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.exp - 60_000 > Date.now()) return cached.token;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(email)
    .setSubject(email)
    .setAudience(tokenUrl())
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(await importPKCS8(key, "RS256"));

  const res = await fetch(tokenUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string };
  if (!res.ok || !data.access_token) {
    throw new Error(`Google sign-in failed (${res.status}): ${data.error_description || "check the service account key"}`);
  }
  cached = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return cached.token;
}

/** A camp's Google event id: its Mongo id (24 hex chars is valid for Google). */
export const eventIdFor = (campId: ObjectId | string) => String(campId).toLowerCase();

function eventBody(c: CampDoc) {
  const lines = [c.description, c.instructions && `Instructions: ${c.instructions}`, c.responsibleName && `Responsible: ${c.responsibleName}`, `Camp ${c.campCode} · ${c.typeLabel}`]
    .filter(Boolean)
    .join("\n\n");
  const timed = !!c.startTime;
  const endTime = c.endTime || c.startTime;
  const next = new Date(`${c.date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return {
    id: eventIdFor(c._id!),
    summary: `${c.name} (${c.typeLabel})`,
    location: c.venue,
    description: lines,
    status: c.status === "cancelled" ? "cancelled" : "confirmed",
    ...(timed
      ? {
          start: { dateTime: `${c.date}T${c.startTime}:00`, timeZone: TZ },
          end: { dateTime: `${c.date}T${endTime}:00`, timeZone: TZ },
        }
      : {
          start: { date: c.date },
          end: { date: next.toISOString().slice(0, 10) },
        }),
  };
}

async function gfetch(method: string, path: string, body?: unknown) {
  const token = await accessToken();
  const res = await fetch(`${apiBase()}/calendars/${encodeURIComponent(process.env.GOOGLE_CALENDAR_ID!)}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; htmlLink?: string; error?: { message?: string } };
  return { res, data };
}

/** Create the event, or update it if it already exists (retry-safe). */
async function upsertEvent(c: CampDoc): Promise<{ eventId: string; htmlLink?: string }> {
  const body = eventBody(c);
  const id = body.id;
  let r = await gfetch("POST", "/events", body);
  if (r.res.status === 409) {
    // Already created by an earlier attempt: update that same event.
    r = await gfetch("PUT", `/events/${id}`, body);
  }
  if (!r.res.ok) throw new Error(`Google Calendar ${r.res.status}: ${r.data.error?.message || "request failed"}`);
  return { eventId: r.data.id || id, htmlLink: r.data.htmlLink };
}

async function cancelEvent(c: CampDoc): Promise<{ eventId: string }> {
  const id = eventIdFor(c._id!);
  const r = await gfetch("PATCH", `/events/${id}`, { status: "cancelled" });
  // 404/410: nothing to cancel (never synced, or already removed) — that's fine.
  if (!r.res.ok && r.res.status !== 404 && r.res.status !== 410) {
    throw new Error(`Google Calendar ${r.res.status}: ${r.data.error?.message || "request failed"}`);
  }
  return { eventId: id };
}

/**
 * Bring the camp's calendar event in line with the camp, record the outcome on
 * the camp and in the sync log. Never throws — a calendar outage must not stop
 * a camp being saved; failures are visible on the camp and can be retried.
 */
export async function syncCampToCalendar(campId: ObjectId): Promise<CalendarState> {
  const camps = await campsCol();
  const camp = await camps.findOne({ _id: campId });
  if (!camp) throw new Error("Camp not found");
  const prev: CalendarState = camp.calendar ?? { status: "pending", attempts: 0 };
  const now = new Date();
  const log = await calendarLogCol();
  const action = camp.status === "cancelled" ? "cancel" : prev.eventId ? "update" : "create";

  let next: CalendarState;
  if (!gcalConfigured()) {
    next = {
      ...prev,
      status: "not_configured",
      lastAttemptAt: now,
      lastError: "Google Calendar is not set up on this server yet (see lib/gcal.ts).",
    };
    await log.insertOne({ campId, at: now, action, ok: false, detail: "not configured" });
  } else {
    try {
      if (camp.status === "cancelled") {
        const r = await cancelEvent(camp);
        next = { ...prev, status: "cancelled", eventId: r.eventId, attempts: prev.attempts + 1, lastAttemptAt: now, syncedAt: now, lastError: undefined };
      } else {
        const r = await upsertEvent(camp);
        next = { status: "synced", eventId: r.eventId, htmlLink: r.htmlLink, attempts: prev.attempts + 1, lastAttemptAt: now, syncedAt: now };
      }
      await log.insertOne({ campId, at: now, action, ok: true, detail: next.eventId });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Calendar sync failed";
      next = { ...prev, status: "failed", attempts: prev.attempts + 1, lastAttemptAt: now, lastError: msg.slice(0, 300) };
      await log.insertOne({ campId, at: now, action, ok: false, detail: msg.slice(0, 300) });
    }
  }
  await camps.updateOne({ _id: campId }, { $set: { calendar: next } });
  return next;
}
