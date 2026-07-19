import type { BudgetCategory, BudgetDoc, BudgetLine, InflationType } from "./models";

/** Funder-format budget categories, in sheet order. */
export const BUDGET_CATEGORIES: {
  key: BudgetCategory;
  label: string;
  group: string;
  staff?: boolean;
}[] = [
  { key: "salary_program", label: "Program staff", group: "1. Salary, Honorarium, Staff benefits", staff: true },
  { key: "salary_admin", label: "Admin staff", group: "1. Salary, Honorarium, Staff benefits", staff: true },
  { key: "capex", label: "Fixed assets / CAPEX", group: "2. Fixed assets / CAPEX" },
  { key: "travel", label: "Travel, Boarding & Lodging", group: "3. Travel, Boarding & Lodging" },
  { key: "program", label: "Program expenses", group: "4. Program expenses" },
  { key: "admin", label: "Administration cost", group: "5. Administration cost" },
];

export const COST_CATEGORIES = ["Salary", "Honorarium", "Consultancy"];
export const UNIT_TYPES = ["Month", "Number", "Week", "Staff", "one-time"];

export const DEFAULT_INFLATION = { salary: 10, nil: 0, other: 5 };

export function inflationRate(doc: Pick<BudgetDoc, "inflationRates">, t: InflationType): number {
  return doc.inflationRates?.[t] ?? DEFAULT_INFLATION[t];
}

/** Year total for one line: units × unitCost × alloc% × (1+inflation)^(yearIdx). */
export function lineYearTotal(
  doc: Pick<BudgetDoc, "inflationRates">,
  line: BudgetLine,
  yearIdx: number
): number {
  const y = line.years[yearIdx];
  if (!y) return 0;
  const rate = inflationRate(doc, line.inflation) / 100;
  const base = (y.units || 0) * (y.unitCost || 0) * ((y.allocPct ?? 100) / 100);
  return Math.round(base * Math.pow(1 + rate, yearIdx));
}

export function lineTotal(doc: Pick<BudgetDoc, "inflationRates">, line: BudgetLine): number {
  let sum = 0;
  for (let i = 0; i < line.years.length; i++) sum += lineYearTotal(doc, line, i);
  return sum;
}

export interface BudgetSummaryRow {
  key: BudgetCategory;
  label: string;
  group: string;
  perYear: number[];
  total: number;
}

/** Category-wise summary with per-year and grand totals. */
export function budgetSummary(doc: BudgetDoc): {
  rows: BudgetSummaryRow[];
  perYear: number[];
  grandTotal: number;
} {
  const years = doc.numYears || 1;
  const rows: BudgetSummaryRow[] = BUDGET_CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    group: c.group,
    perYear: Array(years).fill(0),
    total: 0,
  }));
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const line of doc.lines || []) {
    const row = byKey.get(line.category);
    if (!row) continue;
    for (let i = 0; i < years; i++) {
      const v = lineYearTotal(doc, line, i);
      row.perYear[i] += v;
      row.total += v;
    }
  }
  const perYear = Array(years)
    .fill(0)
    .map((_, i) => rows.reduce((s, r) => s + r.perYear[i], 0));
  const grandTotal = perYear.reduce((s, v) => s + v, 0);
  return { rows, perYear, grandTotal };
}

export function publicBudget(b: BudgetDoc) {
  return {
    id: String(b._id),
    name: b.name,
    currency: b.currency,
    numYears: b.numYears,
    inflationRates: b.inflationRates,
    lines: b.lines ?? [],
    createdByName: b.createdByName ?? null,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}
export type PublicBudget = ReturnType<typeof publicBudget>;
