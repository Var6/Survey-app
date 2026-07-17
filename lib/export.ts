import ExcelJS from "exceljs";
import type { SurveyDoc, LedgerDoc, ExpenseDoc } from "./models";
import { SETTLEMENT_BY_CODE } from "./questionnaire/settlements";

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

/** Build an .xlsx workbook (as a Buffer) from filtered survey rows. */
export async function buildSurveyWorkbook(
  rows: { survey: SurveyDoc; mobiliserName?: string }[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Janman Survey";
  const ws = wb.addWorksheet("Surveys");

  ws.columns = [
    { header: "Household ID", key: "hh", width: 18 },
    { header: "Settlement", key: "settlement", width: 20 },
    { header: "Mobiliser", key: "mob", width: 20 },
    { header: "Mobiliser code", key: "mobcode", width: 14 },
    { header: "Head name", key: "head", width: 22 },
    { header: "Members", key: "members", width: 10 },
    { header: "Livelihood", key: "livelihood", width: 16 },
    { header: "Housing", key: "housing", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Sync", key: "sync", width: 10 },
    { header: "Frappe ID", key: "frappe", width: 14 },
    { header: "Created", key: "created", width: 20 },
  ];
  ws.getRow(1).font = { bold: true };

  for (const { survey, mobiliserName } of rows) {
    const d = survey.data || {};
    ws.addRow({
      hh: survey.householdId,
      settlement:
        SETTLEMENT_BY_CODE[survey.settlementCode]?.label || survey.settlementCode,
      mob: mobiliserName || "",
      mobcode: survey.mobiliserCode || "",
      head: (d.head_name as string) || "",
      members: (d.hh_total_members as number) ?? "",
      livelihood: (d.main_livelihood as string) || "",
      housing: (d.housing_type as string) || "",
      status: survey.status,
      sync: survey.sync?.status || "",
      frappe: survey.sync?.frappeId || "",
      created: survey.createdAt
        ? survey.createdAt.toISOString().slice(0, 19).replace("T", " ")
        : "",
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf as ArrayBuffer);
}
