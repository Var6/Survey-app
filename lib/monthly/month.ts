/**
 * Reporting-month helpers. No database imports, so both the form and the
 * server routes can use them.
 */

/**
 * The month a monthly report is about by default: the one that just finished.
 * Reports are filed after the month ends and are due on the 4th (see
 * ./deadline.ts), so opening the form in October should offer September.
 * Worked out on the India calendar, so on the night of the 31st it is already
 * the new month for the people filing.
 */
export function defaultReportMonth(now: Date = new Date()): string {
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const d = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1));
  d.setUTCMonth(d.getUTCMonth() - 1);
  return monthKey(d);
}

export function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "2026-09" → "September 2026" */
export function monthLabel(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return key;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  return d.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
}

/** The months an author can file for: the last `n`, newest first. */
export function recentMonths(n = 6, now: Date = new Date()): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  for (let i = 0; i < n; i++) {
    out.push(monthKey(d));
    d.setUTCMonth(d.getUTCMonth() - 1);
  }
  return out;
}

/** "YYYY-MM" with a real month number — rejects 2026-00 and 2026-13. */
export function isMonthKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
}
