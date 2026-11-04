import ExcelJS from "exceljs";
import { json, handleError, requireRoles } from "@/lib/api";
import { supportRecordsCol } from "@/lib/models";
import { buildSupportFilter } from "@/lib/support/query";

export const runtime = "nodejs";
const MAX_ROWS = 20000;
const csvCell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

/** Excel (default) or CSV of the support records matching the current filters. */
export async function GET(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager");
    const p = new URL(req.url).searchParams;
    const filter = buildSupportFilter(user, p);
    const col = await supportRecordsCol();
    const total = await col.countDocuments(filter);
    if (total > MAX_ROWS) return json({ error: "Too many records for one file — narrow the dates." }, 413);
    const docs = await col.find(filter).sort({ supportDate: -1, _id: -1 }).toArray();

    const head = ["Date", "Community", "Referral", "Beneficiary", "Phone", "Type of support", "Status", "Verification", "Case", "Household", "Photo links", "Remarks", "Details", "Community Mobiliser", "Source"];
    const rows = docs.map((d) => [
      d.supportDate, d.communityName, d.referralLabel, d.beneficiaryName, d.phone || "", d.supportTypeLabels.join(", "),
      d.status === "complete" ? "Complete" : "Follow-up required",
      d.verification === "not_needed" ? "" : d.verification,
      d.caseCode || "", d.householdId || "", (d.photoLinks || []).join("\n"), d.remarks || "",
      Object.entries(d.details || {}).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`).join("; "),
      d.cmName ? `${d.cmName}${d.cmInferred ? " (from community)" : ""}` : "",
      d.source === "import" ? "Google Sheet" : "App",
    ]);
    const stamp = p.get("from") || p.get("to") ? `${p.get("from") || "start"}_to_${p.get("to") || "today"}` : new Date().toISOString().slice(0, 10);
    const common = { "Cache-Control": "no-store", "X-Total-Rows": String(rows.length) };

    if (p.get("format") === "csv") {
      const csv = "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
      return new Response(csv, { headers: { ...common, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="support-records-${stamp}.csv"` } });
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Support records");
    ws.columns = head.map((h, i) => ({ header: h, key: String(i), width: [12, 24, 16, 22, 13, 30, 18, 13, 11, 14, 40, 30, 36, 24, 12][i] }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => (ws.addRow(r).alignment = { vertical: "top", wrapText: true }));

    // A second sheet with the numbers a report needs: community × status.
    const by = new Map<string, { total: number; complete: number; followUp: number; verified: number }>();
    for (const d of docs) {
      const a = by.get(d.communityName) || { total: 0, complete: 0, followUp: 0, verified: 0 };
      a.total++;
      if (d.status === "complete") a.complete++; else a.followUp++;
      if (d.verification === "verified") a.verified++;
      by.set(d.communityName, a);
    }
    const sm = wb.addWorksheet("By community");
    sm.columns = ["Community", "Records", "Complete", "Follow-up required", "Verified"].map((h, i) => ({ header: h, key: String(i), width: [28, 12, 12, 20, 12][i] }));
    sm.getRow(1).font = { bold: true };
    [...by.entries()].sort((a, b) => b[1].total - a[1].total).forEach(([k, v]) => sm.addRow([k, v.total, v.complete, v.followUp, v.verified]));

    const buf = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buf as ArrayBuffer), { headers: { ...common, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="support-records-${stamp}.xlsx"` } });
  } catch (e) {
    return handleError(e);
  }
}
