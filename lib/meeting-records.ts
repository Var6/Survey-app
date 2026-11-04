import { ObjectId, type Filter } from "mongodb";
import { HttpError } from "./api";
import type { MeetingRecordDoc, UserDoc } from "./models";
import { isDateStr } from "./time";
import { clip } from "./schedule";

/** Where photos and attendance sheets may live: Google Drive / Photos only. */
const LINK_HOSTS = [
  "drive.google.com",
  "docs.google.com",
  "photos.google.com",
  "photos.app.goo.gl",
  "goo.gl",
  "forms.gle",
];

/**
 * Turn what the user typed (one link per line, or separated by commas/spaces)
 * into a clean list. Every link must be https and on Google Drive / Photos, so
 * a record can never point readers at an arbitrary website.
 */
export function parseLinks(raw: unknown, label: string): string[] {
  const parts = Array.isArray(raw)
    ? raw.map(String)
    : String(raw ?? "").split(/[\s,]+/);
  const links = [...new Set(parts.map((p) => p.trim()).filter(Boolean))];
  if (links.length > 12) throw new HttpError(400, `${label}: at most 12 links`);
  for (const l of links) {
    let u: URL;
    try {
      u = new URL(l);
    } catch {
      throw new HttpError(400, `${label}: “${l.slice(0, 40)}” is not a valid link`);
    }
    if (u.protocol !== "https:" || !LINK_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))) {
      throw new HttpError(400, `${label}: use a Google Drive / Google Photos link (https://drive.google.com/…)`);
    }
  }
  return links;
}

export function parseParticipants(v: unknown): number {
  const n = Number(String(v ?? "").trim());
  if (!Number.isInteger(n) || n < 0 || n > 100000) {
    throw new HttpError(400, "Total participants must be a whole number");
  }
  return n;
}

export function cleanTopic(v: unknown): string {
  const t = clip(v, 8000);
  if (t.length < 3) throw new HttpError(400, "Write what was discussed");
  return t;
}

export function checkMeetingDate(v: unknown, today: string): string {
  const d = clip(v, 10);
  if (!isDateStr(d)) throw new HttpError(400, "Choose the meeting date");
  if (d > today) throw new HttpError(400, "The meeting date cannot be in the future");
  return d;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One filter for the list, the summary and the exports. A CM only ever sees their own. */
export function buildRecordFilter(
  user: Pick<UserDoc, "_id" | "role">,
  p: URLSearchParams
): Filter<MeetingRecordDoc> {
  const and: Filter<MeetingRecordDoc>[] = [];
  if (user.role === "cm") and.push({ cmId: user._id });
  const from = p.get("from");
  const to = p.get("to");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) and.push({ meetingDate: { $gte: from } });
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) and.push({ meetingDate: { $lte: to } });
  const settlement = p.get("settlement");
  if (settlement) and.push({ settlementCode: settlement });
  const type = p.get("type");
  if (type) and.push({ typeKey: type });
  const cm = p.get("cm");
  if (cm && user.role !== "cm") {
    try {
      and.push({ cmId: new ObjectId(cm) });
    } catch {
      /* ignore a malformed id */
    }
  }
  if (p.get("evidence") === "missing") {
    and.push({ $or: [{ attendanceLinks: { $size: 0 } }, { photoLinks: { $size: 0 } }] });
  }
  const q = (p.get("q") || "").trim();
  if (q) {
    const re = { $regex: escapeRe(q), $options: "i" };
    and.push({ $or: [{ topic: re }, { remarks: re }, { communityName: re }, { cmName: re }] });
  }
  return and.length ? { $and: and } : {};
}
