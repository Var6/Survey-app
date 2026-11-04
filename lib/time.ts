/**
 * India time (the programme runs in Bihar). Stored instants are UTC; every
 * "today", "due date" and "deadline" decision is made on the India calendar.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Today's date in India as YYYY-MM-DD. */
export function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** Calendar parts of an instant, read on the India clock. */
export function istParts(now: Date = new Date()) {
  const d = new Date(now.getTime() + IST_OFFSET_MS);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1, // 1–12
    day: d.getUTCDate(),
  };
}

export const isDateStr = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));

export const isTimeStr = (v: unknown): v is string =>
  typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
