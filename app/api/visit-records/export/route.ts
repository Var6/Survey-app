import ExcelJS from "exceljs";
import { json, handleError, requireRoles } from "@/lib/api";
import { visitRecordsCol } from "@/lib/models";
import { buildVisitFilter, visitedTypeLabel } from "@/lib/visit-records";

export const runtime = "nodejs";
const MAX_ROWS = 20000;

const csvCell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

/** Excel (default) or CSV of the visit reports matching the current filters. */
export async function GET(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager");
    const p = new URL(req.url).searchParams;
    const filter = buildVisitFilter(user, p);
    const col = await visitRecordsCol();
    const total = await col.countDocuments(filter);
    if (total > MAX_ROWS) return json({ error: "Too many reports for one file — narrow the dates." }, 413);
    const docs = await col.find(filter).sort({ visitDate: -1, _id: -1 }).toArray();

    const filed = (d: (typeof docs)[number]) => d.cmName || (d.source === "import" ? "Imported (Google Form)" : "");
    const when = (d: (typeof docs)[number]) =>
      new Date(d.submittedAt.getTime() + 5.5 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
    const head = [
      "Date of visit", "Community", "Visited", "People met", "What was discussed",
      "School", "Principal", "Principal phone", "ASHA", "ASHA phone", "ANM", "ANM phone",
      "Health facility", "Doctor", "Doctor phone", "Photo links", "Remarks", "Filed by", "Filed on",
    ];
    const rows = docs.map((d) => [
      d.visitDate, d.communityName, visitedTypeLabel(d.visitedType), d.stakeholderNames || "", d.discussion,
      d.schoolName || "", d.principalName || "", d.principalPhone || "", d.ashaName || "", d.ashaPhone || "", d.anmName || "", d.anmPhone || "",
      d.facilityName || "", d.doctorName || "", d.doctorPhone || "", (d.photoLinks || []).join("\n"), d.remarks || "", filed(d), when(d),
    ]);
    const stamp = p.get("from") || p.get("to") ? `${p.get("from") || "start"}_to_${p.get("to") || "today"}` : new Date().toISOString().slice(0, 10);
    const common = { "Cache-Control": "no-store", "X-Total-Rows": String(rows.length) };

    if (p.get("format") === "csv") {
      const csv = "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
      return new Response(csv, { headers: { ...common, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="visit-reports-${stamp}.csv"` } });
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Visit reports");
    const widths = [12, 22, 16, 26, 60, 28, 22, 16, 20, 16, 20, 16, 26, 22, 16, 40, 40, 20, 18];
    ws.columns = head.map((h, i) => ({ header: h, key: String(i), width: widths[i] }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => (ws.addRow(r).alignment = { vertical: "top", wrapText: true }));
    const buf = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buf as ArrayBuffer), { headers: { ...common, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="visit-reports-${stamp}.xlsx"` } });
  } catch (e) {
    return handleError(e);
  }
}
