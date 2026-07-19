import ExcelJS from "exceljs";
import type {
  SurveyDoc,
  LedgerDoc,
  ExpenseDoc,
  ReportDoc,
  WeeklyReportDoc,
  MonthlyReportDoc,
  BudgetDoc,
} from "./models";
import {
  BUDGET_CATEGORIES,
  budgetSummary,
  lineYearTotal,
  lineTotal,
  inflationRate,
} from "./budget";
import { SETTLEMENT_BY_CODE } from "./questionnaire/settlements";
import {
  allTopLevelFields,
  repeatGroups,
  isRepeat,
  type Field,
} from "./questionnaire";

function fmtDate(d: Date | undefined): string {
  return d ? d.toISOString().slice(0, 19).replace("T", " ") : "";
}

/** Finance workbook: a Statement sheet (ledger) + an Expenses sheet. */
export async function buildFinanceWorkbook(
  entries: LedgerDoc[],
  expenses: ExpenseDoc[],
  projectName: (id: string) => string
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Janman Survey";

  const stmt = wb.addWorksheet("Statement");
  stmt.columns = [
    { header: "Date", key: "date", width: 20 },
    { header: "Project", key: "project", width: 24 },
    { header: "Type", key: "type", width: 12 },
    { header: "Credit", key: "credit", width: 14 },
    { header: "Debit", key: "debit", width: 14 },
    { header: "Balance", key: "balance", width: 14 },
    { header: "Detail", key: "note", width: 40 },
  ];
  stmt.getRow(1).font = { bold: true };
  for (const e of entries) {
    const isCredit = e.type === "allocation";
    stmt.addRow({
      date: fmtDate(e.createdAt),
      project: projectName(String(e.projectId)),
      type: e.type,
      credit: isCredit ? e.amount : "",
      debit: isCredit ? "" : e.amount,
      balance: e.balanceAfter,
      note: e.note || "",
    });
  }

  const exp = wb.addWorksheet("Expenses");
  exp.columns = [
    { header: "Date", key: "date", width: 20 },
    { header: "Project", key: "project", width: 24 },
    { header: "Category", key: "category", width: 16 },
    { header: "Paid to", key: "paidTo", width: 20 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Description", key: "desc", width: 40 },
    { header: "Recorded by", key: "by", width: 20 },
  ];
  exp.getRow(1).font = { bold: true };
  for (const x of expenses) {
    exp.addRow({
      date: fmtDate(x.date),
      project: projectName(String(x.projectId)),
      category: x.category,
      paidTo: x.paidTo || "",
      amount: x.amount,
      desc: x.description || "",
      by: x.createdByName || "",
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

/** English display value: option codes → English labels; arrays joined. */
function enValue(field: Field, val: unknown): string | number {
  if (val === null || val === undefined || val === "") return "";
  if (Array.isArray(val)) {
    return val
      .map((c) => field.options?.find((o) => o.code === String(c))?.en ?? String(c))
      .join(", ");
  }
  if (field.type === "select") {
    return field.options?.find((o) => o.code === String(val))?.en ?? String(val);
  }
  if (field.type === "integer" && Number.isFinite(Number(val))) return Number(val);
  return String(val);
}

/** Doc key on SurveyDoc for each repeat group. */
const REPEAT_DOC_KEY: Record<string, keyof SurveyDoc> = {
  household_members: "members",
  children_0_3: "children_0_3",
  children_4_12: "children_4_12",
  youth_13_24: "youth_13_24",
};

/**
 * Full-questionnaire survey workbook. The app UI is Hindi-first, but the
 * export uses ENGLISH column headers and English option labels throughout.
 * Repeat groups (members / children / youth) get their own sheets keyed by
 * Household ID.
 */
export async function buildSurveyWorkbook(
  rows: { survey: SurveyDoc; mobiliserName?: string }[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Janman Survey";

  const fields = allTopLevelFields().filter((f) => f.type !== "note");
  const ws = wb.addWorksheet("Surveys");
  ws.columns = [
    { header: "Household ID", key: "hh", width: 18 },
    { header: "Settlement", key: "settlement", width: 20 },
    { header: "Mobiliser", key: "mob", width: 20 },
    { header: "Mobiliser code", key: "mobcode", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Frappe sync", key: "sync", width: 12 },
    { header: "Frappe ID", key: "frappe", width: 14 },
    { header: "Created", key: "created", width: 20 },
    ...fields.map((f) => ({
      header: f.label.en,
      key: f.name,
      width: Math.min(Math.max(f.label.en.length + 2, 14), 40),
    })),
  ];
  ws.getRow(1).font = { bold: true };

  for (const { survey, mobiliserName } of rows) {
    const d = survey.data || {};
    const row: Record<string, unknown> = {
      hh: survey.householdId,
      settlement:
        SETTLEMENT_BY_CODE[survey.settlementCode]?.label || survey.settlementCode,
      mob: mobiliserName || "",
      mobcode: survey.mobiliserCode || "",
      status: survey.status,
      sync: survey.sync?.status || "",
      frappe: survey.sync?.frappeId || "",
      created: fmtDate(survey.createdAt),
    };
    for (const f of fields) row[f.name] = enValue(f, d[f.name]);
    ws.addRow(row);
  }

  // One sheet per repeat group, keyed by Household ID.
  for (const group of repeatGroups()) {
    if (!isRepeat(group)) continue;
    const docKey = REPEAT_DOC_KEY[group.name];
    if (!docKey) continue;
    const sheet = wb.addWorksheet(group.label.en.slice(0, 28));
    sheet.columns = [
      { header: "Household ID", key: "hh", width: 18 },
      { header: "#", key: "idx", width: 5 },
      ...group.fields.map((f) => ({
        header: f.label.en,
        key: f.name,
        width: Math.min(Math.max(f.label.en.length + 2, 14), 36),
      })),
    ];
    sheet.getRow(1).font = { bold: true };
    for (const { survey } of rows) {
      const items = (survey[docKey] as Record<string, unknown>[] | undefined) || [];
      items.forEach((item, i) => {
        const row: Record<string, unknown> = { hh: survey.householdId, idx: i + 1 };
        for (const f of group.fields) row[f.name] = enValue(f, item[f.name]);
        sheet.addRow(row);
      });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

/** Daily update reports (CM or PM) — one row per report. */
export async function buildDailyReportsWorkbook(
  rows: { report: ReportDoc; authorName?: string }[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Janman Survey";
  const ws = wb.addWorksheet("Daily reports");
  ws.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Name", key: "name", width: 22 },
    { header: "Settlements", key: "settlements", width: 28 },
    { header: "Where did you work & what did you do?", key: "work", width: 50 },
    { header: "What was completed today?", key: "completed", width: 50 },
    { header: "Issues / delays / risks", key: "issues", width: 45 },
    { header: "Priority actions for tomorrow", key: "tomorrow", width: 50 },
    { header: "Submitted at", key: "submitted", width: 20 },
  ];
  ws.getRow(1).font = { bold: true };
  for (const { report, authorName } of rows) {
    const d = report.data || {};
    const settlements = Array.isArray(d.settlements_worked)
      ? (d.settlements_worked as string[])
          .map((c) => SETTLEMENT_BY_CODE[c]?.label || c)
          .join(", ")
      : "";
    ws.addRow({
      date: report.periodDate ? report.periodDate.toISOString().slice(0, 10) : "",
      name: authorName || "",
      settlements,
      work: (d.work_done as string) || "",
      completed: (d.completed_today as string) || "",
      issues: (d.issues_risks as string) || "",
      tomorrow: (d.tomorrow_priorities as string) || "",
      submitted: fmtDate(report.createdAt),
    });
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

function flatCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** PM weekly reports — narrative data flattened to columns. */
export async function buildWeeklyWorkbook(docs: WeeklyReportDoc[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Janman Survey";
  const ws = wb.addWorksheet("Weekly reports");
  const dataKeys = [
    ...new Set(docs.flatMap((d) => Object.keys(d.data || {}))),
  ];
  ws.columns = [
    { header: "Report ID", key: "reportId", width: 16 },
    { header: "Programme Manager", key: "pm", width: 22 },
    { header: "Week start", key: "start", width: 13 },
    { header: "Week end", key: "end", width: 13 },
    { header: "Status", key: "status", width: 12 },
    { header: "Submitted at", key: "submitted", width: 20 },
    { header: "Director comments", key: "comments", width: 40 },
    ...dataKeys.map((k) => ({ header: k, key: `d_${k}`, width: 32 })),
  ];
  ws.getRow(1).font = { bold: true };
  for (const doc of docs) {
    const row: Record<string, unknown> = {
      reportId: doc.reportId,
      pm: doc.pmName || "",
      start: doc.weekStart.toISOString().slice(0, 10),
      end: doc.weekEnd.toISOString().slice(0, 10),
      status: doc.status,
      submitted: fmtDate(doc.submittedAt),
      comments: doc.directorComments || "",
    };
    for (const k of dataKeys) row[`d_${k}`] = flatCell((doc.data || {})[k]);
    ws.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

/** Programme budget — Summary sheet + per-line Budget sheet (funder format). */
export async function buildBudgetWorkbook(doc: BudgetDoc): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Janman Survey";
  const years = doc.numYears || 1;
  const yearHeaders = Array.from({ length: years }, (_, i) => `Year ${i + 1}`);

  // ── Summary sheet ──
  const sum = wb.addWorksheet("Summary");
  sum.columns = [
    { header: "Budget Category", key: "cat", width: 36 },
    ...yearHeaders.map((h, i) => ({ header: h, key: `y${i}`, width: 14 })),
    { header: "Total", key: "total", width: 15 },
    { header: "%", key: "pct", width: 8 },
  ];
  sum.getRow(1).font = { bold: true };
  const s = budgetSummary(doc);
  // Group salary rows under one heading like the funder sheet.
  for (const row of s.rows) {
    const r: Record<string, unknown> = { cat: `${row.group} — ${row.label}`, total: row.total };
    row.perYear.forEach((v, i) => (r[`y${i}`] = v));
    r.pct = s.grandTotal ? `${Math.round((row.total / s.grandTotal) * 100)}%` : "0%";
    sum.addRow(r);
  }
  const totalRow: Record<string, unknown> = { cat: "TOTAL", total: s.grandTotal, pct: "100%" };
  s.perYear.forEach((v, i) => (totalRow[`y${i}`] = v));
  const tr = sum.addRow(totalRow);
  tr.font = { bold: true };

  // ── Budget detail sheet ──
  const det = wb.addWorksheet("Budget");
  const yearCols = yearHeaders.flatMap((h, i) => [
    { header: `${h} Units`, key: `u${i}`, width: 10 },
    { header: `${h} Unit cost`, key: `c${i}`, width: 12 },
    { header: `${h} % alloc`, key: `a${i}`, width: 9 },
    { header: `${h} Total`, key: `t${i}`, width: 14 },
  ]);
  det.columns = [
    { header: "Category", key: "cat", width: 26 },
    { header: "Description", key: "desc", width: 36 },
    { header: "Cost category", key: "cc", width: 14 },
    { header: "Inflation", key: "inf", width: 10 },
    { header: "Unit type", key: "ut", width: 10 },
    ...yearCols,
    { header: "Total", key: "total", width: 15 },
    { header: "Budget notes", key: "notes", width: 50 },
  ];
  det.getRow(1).font = { bold: true };
  const catLabel = new Map(BUDGET_CATEGORIES.map((c) => [c.key, c.label]));
  for (const line of doc.lines || []) {
    const row: Record<string, unknown> = {
      cat: catLabel.get(line.category) || line.category,
      desc: line.description,
      cc: line.costCategory || "",
      inf: `${inflationRate(doc, line.inflation)}%`,
      ut: line.unitType || "",
      total: lineTotal(doc, line),
      notes: line.notes || "",
    };
    for (let i = 0; i < years; i++) {
      const y = line.years[i];
      row[`u${i}`] = y?.units ?? 0;
      row[`c${i}`] = y?.unitCost ?? 0;
      row[`a${i}`] = `${y?.allocPct ?? 100}%`;
      row[`t${i}`] = lineYearTotal(doc, line, i);
    }
    det.addRow(row);
  }

  // ── Working sheet (cost break-up per programme expense) ──
  const workingLines = (doc.lines || []).filter(
    (l) =>
      l.working &&
      ((l.working.food || 0) +
        (l.working.accommodation || 0) +
        (l.working.resource || 0) +
        (l.working.iec || 0) +
        (l.working.others || 0) >
        0 ||
        l.working.assumptions)
  );
  if (workingLines.length > 0) {
    const wk = wb.addWorksheet("Working");
    wk.columns = [
      { header: "Program expense", key: "desc", width: 36 },
      { header: "Food", key: "food", width: 12 },
      { header: "Accomodation", key: "acc", width: 14 },
      { header: "Resource fee/ Consultant", key: "res", width: 20 },
      { header: "IEC", key: "iec", width: 12 },
      { header: "Others", key: "oth", width: 12 },
      { header: "Total", key: "total", width: 14 },
      { header: "Assumptions", key: "assumptions", width: 60 },
    ];
    wk.getRow(1).font = { bold: true };
    for (const l of workingLines) {
      const w = l.working!;
      wk.addRow({
        desc: l.description,
        food: w.food || 0,
        acc: w.accommodation || 0,
        res: w.resource || 0,
        iec: w.iec || 0,
        oth: w.others || 0,
        total:
          (w.food || 0) +
          (w.accommodation || 0) +
          (w.resource || 0) +
          (w.iec || 0) +
          (w.others || 0),
        assumptions: w.assumptions || "",
      });
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}

/** PM monthly reports — narrative data flattened to columns. */
export async function buildMonthlyWorkbook(docs: MonthlyReportDoc[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Janman Survey";
  const ws = wb.addWorksheet("Monthly reports");
  const dataKeys = [...new Set(docs.flatMap((d) => Object.keys(d.data || {})))];
  ws.columns = [
    { header: "Report ID", key: "reportId", width: 16 },
    { header: "Programme Manager", key: "pm", width: 22 },
    { header: "Month start", key: "start", width: 13 },
    { header: "Month end", key: "end", width: 13 },
    { header: "Status", key: "status", width: 12 },
    { header: "Submitted at", key: "submitted", width: 20 },
    { header: "Director comments", key: "comments", width: 40 },
    ...dataKeys.map((k) => ({ header: k, key: `d_${k}`, width: 32 })),
  ];
  ws.getRow(1).font = { bold: true };
  for (const doc of docs) {
    const row: Record<string, unknown> = {
      reportId: doc.reportId,
      pm: doc.pmName || "",
      start: doc.monthStart.toISOString().slice(0, 10),
      end: doc.monthEnd.toISOString().slice(0, 10),
      status: doc.status,
      submitted: fmtDate(doc.submittedAt),
      comments: doc.directorComments || "",
    };
    for (const k of dataKeys) row[`d_${k}`] = flatCell((doc.data || {})[k]);
    ws.addRow(row);
  }
  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
