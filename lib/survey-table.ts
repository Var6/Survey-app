import type { SurveyDoc } from "./models";
import { SETTLEMENT_BY_CODE } from "./questionnaire/settlements";

/** One flat line per survey — the shared shape for the CSV export and the PDF/print list. */
export interface SurveyLine {
  householdId: string;
  date: string; // India calendar date, YYYY-MM-DD
  settlement: string;
  mobiliser: string;
  headName: string;
  members: string;
  status: string;
  sync: string;
  frappeId: string;
}

export const SURVEY_LINE_HEADERS: { key: keyof SurveyLine; label: string }[] = [
  { key: "householdId", label: "Household ID" },
  { key: "date", label: "Survey date" },
  { key: "settlement", label: "Settlement" },
  { key: "mobiliser", label: "Mobiliser" },
  { key: "headName", label: "Household head" },
  { key: "members", label: "Members" },
  { key: "status", label: "Status" },
  { key: "sync", label: "Frappe sync" },
  { key: "frappeId", label: "Frappe ID" },
];

const istDate = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);

export function toSurveyLine(
  survey: SurveyDoc,
  mobiliserName: string | undefined,
  labels: Record<string, string>
): SurveyLine {
  const d = survey.data || {};
  return {
    householdId: survey.householdId,
    date: istDate(survey.createdAt),
    settlement: labels[survey.settlementCode] || SETTLEMENT_BY_CODE[survey.settlementCode]?.label || survey.settlementCode,
    mobiliser: mobiliserName || "",
    headName: String(d.head_name ?? ""),
    members: d.hh_total_members == null ? "" : String(d.hh_total_members),
    status: survey.status,
    sync: survey.sync?.status || "",
    frappeId: survey.sync?.frappeId || "",
  };
}

/** CSV cell: quoted, and defanged if a spreadsheet would read it as a formula. */
function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function surveyLinesToCsv(lines: SurveyLine[]): string {
  const head = SURVEY_LINE_HEADERS.map((h) => csvCell(h.label)).join(",");
  const body = lines.map((l) => SURVEY_LINE_HEADERS.map((h) => csvCell(l[h.key])).join(","));
  // BOM so Excel opens Hindi names correctly.
  return "﻿" + [head, ...body].join("\r\n") + "\r\n";
}
