import ExcelJS from "exceljs";
import { json, handleError, requireRoles } from "@/lib/api";
import { meetingRecordsCol } from "@/lib/models";
import { buildRecordFilter, kindOf } from "@/lib/meeting-records";

export const runtime = "nodejs";
const MAX_ROWS = 20000;

const csvCell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

/** Excel (default) or CSV of the meeting reports matching the current filters. */
export async function GET(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager");
    const p = new URL(req.url).searchParams;
    const filter = buildRecordFilter(user, p);
    const col = await meetingRecordsCol();
    const total = await col.countDocuments(filter);
    if (total > MAX_ROWS) return json({ error: "Too many reports for one file — narrow the dates." }, 413);
    const docs = await col.find(filter).sort({ meetingDate: -1, _id: -1 }).toArray();

    const camp = kindOf(p.get("kind")) === "camp";
    const filed = (d: (typeof docs)[number]) =>
      d.cmName || (d.source === "import" ? "Imported (Google Form)" : "");
    const when = (d: (typeof docs)[number]) =>
      new Date(d.submittedAt.getTime() + 5.5 * 3600e3).toISOString().slice(0, 16).replace("T", " ");
    const head = camp
      ? ["Date of camp", "Community", "Type of camp", "Support given at the camp", "Supported by (type)", "Supporting organisation / person", "Total participants", "Participating doctors / members", "Attendance photo links", "Group photo links", "Remarks", "Filed by", "Filed on"]
      : ["Meeting date", "Community", "Type of meeting", "Topic discussed", "Total participants", "Attendance sheet links", "Group photo links", "Remarks", "Filed by", "Filed on"];
    const rows = docs.map((d) =>
      camp
        ? [d.meetingDate, d.communityName, d.typeLabel, d.topic, d.stakeholderTypeLabel || "", d.stakeholderName || "", d.totalParticipants == null ? "" : String(d.totalParticipants), d.participantNotes || "", (d.attendanceLinks || []).join("\n"), (d.photoLinks || []).join("\n"), d.remarks || "", filed(d), when(d)]
        : [d.meetingDate, d.communityName, d.typeLabel, d.topic, d.totalParticipants == null ? "" : String(d.totalParticipants), (d.attendanceLinks || []).join("\n"), (d.photoLinks || []).join("\n"), d.remarks || "", filed(d), when(d)]
    );
    const stamp = p.get("from") || p.get("to") ? `${p.get("from") || "start"}_to_${p.get("to") || "today"}` : new Date().toISOString().slice(0, 10);
    const common = { "Cache-Control": "no-store", "X-Total-Rows": String(rows.length) };

    if (p.get("format") === "csv") {
      const csv = "﻿" + [head, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
      return new Response(csv, { headers: { ...common, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${camp ? "camp" : "meeting"}-reports-${stamp}.csv"` } });
    }
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(camp ? "Camp reports" : "Meeting reports");
    ws.columns = head.map((h, i) => ({ header: h, key: String(i), width: (camp ? [12, 22, 16, 50, 16, 28, 12, 36, 40, 40, 40, 20, 18] : [12, 22, 20, 60, 12, 40, 40, 40, 20, 18])[i] }));
    ws.getRow(1).font = { bold: true };
    rows.forEach((r) => ws.addRow(r).alignment = { vertical: "top", wrapText: true });
    const buf = await wb.xlsx.writeBuffer();
    return new Response(new Uint8Array(buf as ArrayBuffer), { headers: { ...common, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${camp ? "camp" : "meeting"}-reports-${stamp}.xlsx"` } });
  } catch (e) {
    return handleError(e);
  }
}
