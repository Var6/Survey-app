import { istParts } from "@/lib/time";

/**
 * Monthly report deadline — the ONE place it is defined.
 *
 * A report for month M is due by the end of day MONTHLY_DEADLINE_DAY of month
 * M+1, India time (so the September report is due on 4 October). It used to be
 * the 3rd for Community Mobilisers and the 5th for MIS / Programme Manager in
 * the form notes; everything now follows this one value.
 *
 * No browser or server code should write "4th" itself — import from here.
 */
export const MONTHLY_DEADLINE_DAY = 4;

/** Days before the deadline on which a reminder is sent (see /api/cron/daily). */
export const REMINDER_DAYS_BEFORE = [3, 1, 0];

const IST = "+05:30";

/** The instant the deadline passes: end of day 4, India time. */
export function deadlineFor(monthKey: string): Date {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(monthKey);
  if (!m) throw new Error(`Bad month key: ${monthKey}`);
  let y = Number(m[1]);
  let mo = Number(m[2]) + 1; // the month after the one being reported
  if (mo > 12) {
    mo = 1;
    y += 1;
  }
  const day = String(MONTHLY_DEADLINE_DAY).padStart(2, "0");
  return new Date(`${y}-${String(mo).padStart(2, "0")}-${day}T23:59:59.999${IST}`);
}

/** True once the deadline for that month's report has passed. */
export function isLate(monthKey: string, at: Date = new Date()): boolean {
  return at.getTime() > deadlineFor(monthKey).getTime();
}

/** The month a report is being filed for right now: the one that just ended, on the India calendar. */
export function reportingMonthNow(now: Date = new Date()): string {
  const { year, month } = istParts(now);
  const y = month === 1 ? year - 1 : year;
  const mo = month === 1 ? 12 : month - 1;
  return `${y}-${String(mo).padStart(2, "0")}`;
}

/** "4 November 2026" / "4 नवंबर 2026" */
export function deadlineLabel(monthKey: string, lang: "en" | "hi" = "en"): string {
  const d = deadlineFor(monthKey);
  return d.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

/** Whole days left until the deadline (0 = due today, negative = late). */
export function daysUntilDeadline(monthKey: string, now: Date = new Date()): number {
  const { year, month, day } = istParts(now);
  const end = deadlineFor(monthKey);
  const e = istParts(end);
  const a = Date.UTC(year, month - 1, day);
  const b = Date.UTC(e.year, e.month - 1, e.day);
  return Math.round((b - a) / 86_400_000);
}
