/**
 * Reporting-month helpers. No database imports, so both the form and the
 * server routes can use them.
 */

/**
 * The month a monthly report is about by default: the one that just finished.
 * Reports are filed after the month ends (CM by the 3rd, PM and MIS by the
 * 5th), so opening the form in October should offer September.
 */
export function defaultReportMonth(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
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
