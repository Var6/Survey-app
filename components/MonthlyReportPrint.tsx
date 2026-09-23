import { labelText, type Field } from "@/lib/questionnaire";
import { variantForAuthorRole } from "@/lib/monthly/variants";
import { SETTLEMENT_BY_CODE } from "@/lib/questionnaire/settlements";
import type { MonthlyReportDoc } from "@/lib/models";

/**
 * Read-only, print-ready rendering of one monthly report — the hard-copy
 * counterpart of the Excel export. Questions come from the same variant
 * schema the form uses, so a printed copy always matches what was filled in.
 */

function optLabel(field: Field, code: string): string {
  const op = field.options?.find((o) => o.code === code);
  return op ? (op.hi && op.hi.trim() ? op.hi : op.en) : code;
}

function display(field: Field, val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  if (Array.isArray(val)) {
    if (val.length === 0) return null;
    return val.map((c) => optLabel(field, String(c))).join(", ");
  }
  if (field.type === "select") return optLabel(field, String(val));
  return String(val);
}

const d10 = (d: Date | string | undefined) =>
  d ? new Date(d).toISOString().slice(0, 10) : "—";

const ROLE_LABEL: Record<string, string> = {
  programme_manager: "Programme Manager",
  cm: "Community Mobiliser",
  mis: "Supervisor cum MIS Assistant",
};

const SETTLEMENT_CLS: Record<string, string> = {
  green: "bg-teal-100 text-teal-900",
  amber: "bg-amber-100 text-amber-900",
  red: "bg-red-100 text-red-900",
};

export default function MonthlyReportPrint({
  report,
  authorName,
}: {
  report: MonthlyReportDoc;
  authorName?: string;
}) {
  const variant = variantForAuthorRole(report.authorRole);
  const data = report.data || {};
  const cert = report.certification || {};
  const answered = (f: Field) => display(f, data[f.name]);

  return (
    <article className="report mx-auto max-w-3xl bg-white p-6 text-zinc-900 print:max-w-none print:p-0">
      {/* Letterhead */}
      <header className="mb-4 border-b-2 border-teal-700 pb-3">
        <p className="text-[11px] font-bold uppercase tracking-widest text-teal-700">
          Janman Peoples Foundation · Purnea Urban Initiative
        </p>
        <h1 className="mt-1 text-xl font-bold">
          {ROLE_LABEL[report.authorRole || "programme_manager"]} — Monthly Report
        </h1>
        <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Report ID</dt>
            <dd className="font-semibold">{report.reportId}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Name</dt>
            <dd className="font-semibold">{authorName || report.pmName || "—"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Month</dt>
            <dd className="font-semibold">
              {d10(report.monthStart)} – {d10(report.monthEnd)}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wide text-zinc-500">Status</dt>
            <dd className="font-semibold capitalize">{report.status}</dd>
          </div>
        </div>
        <p className="mt-1 text-[11px] text-zinc-500">
          Submitted {d10(report.submittedAt)}
          {report.reviewedAt ? ` · Reviewed ${d10(report.reviewedAt)}` : ""}
        </p>
      </header>

      {/* Settlement traffic light (Programme Manager only) */}
      {variant.hasSettlementControl && (report.settlements || []).length > 0 && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="mb-1.5 border-b border-zinc-300 pb-1 text-sm font-bold">
            Settlement-wise oversight
          </h2>
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-zinc-100 text-left">
                <th className="border border-zinc-300 px-2 py-1">Settlement</th>
                <th className="border border-zinc-300 px-2 py-1">Status</th>
                <th className="border border-zinc-300 px-2 py-1">Reason</th>
                <th className="border border-zinc-300 px-2 py-1">Corrective action</th>
              </tr>
            </thead>
            <tbody>
              {(report.settlements || []).map((s) => (
                <tr key={s.code} className="break-inside-avoid">
                  <td className="border border-zinc-300 px-2 py-1">
                    {SETTLEMENT_BY_CODE[s.code]?.label || s.code}
                  </td>
                  <td className={`border border-zinc-300 px-2 py-1 font-semibold capitalize ${SETTLEMENT_CLS[s.status] || ""}`}>
                    {s.status}
                  </td>
                  <td className="border border-zinc-300 px-2 py-1">{s.reason || ""}</td>
                  <td className="border border-zinc-300 px-2 py-1">{s.corrective || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Narrative sections, straight from the variant's schema */}
      {variant.sections.map((section) => {
        const rows = section.items
          .map((it) => {
            const f = it as Field;
            if (f.type === "note") return null;
            const value = answered(f);
            return value ? { key: f.name, label: labelText(f.label), value } : null;
          })
          .filter(Boolean) as { key: string; label: string; value: string }[];
        if (rows.length === 0) return null;
        return (
          <section key={section.id} className="mb-4 break-inside-avoid">
            <h2 className="mb-1.5 border-b border-zinc-300 pb-1 text-sm font-bold">
              <span className="mr-1.5 inline-block rounded bg-teal-700 px-1.5 text-xs text-white">
                {section.id}
              </span>
              {labelText(section.title)}
            </h2>
            <dl className="space-y-1.5">
              {rows.map((r) => (
                <div key={r.key} className="break-inside-avoid text-sm">
                  <dt className="text-xs text-zinc-600">{r.label}</dt>
                  <dd className="whitespace-pre-wrap font-medium">{r.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        );
      })}

      {/* Declaration */}
      <section className="mb-4 break-inside-avoid">
        <h2 className="mb-1.5 border-b border-zinc-300 pb-1 text-sm font-bold">Declaration</h2>
        {variant.certification.map((c) => (
          <p key={c.key} className="text-sm">
            {cert[c.key] ? "☑" : "☐"} {c.label}
          </p>
        ))}
        {cert.final_comment ? (
          <p className="mt-1 whitespace-pre-wrap text-sm">{String(cert.final_comment)}</p>
        ) : null}
      </section>

      {/* Reviewer's decision */}
      {(report.directorComments || (report.directorActionPoints || []).length > 0) && (
        <section className="mb-4 break-inside-avoid">
          <h2 className="mb-1.5 border-b border-zinc-300 pb-1 text-sm font-bold">
            {variant.reviewerRole === "director" ? "Director" : "Programme Manager"} review
          </h2>
          {report.directorComments && (
            <p className="whitespace-pre-wrap text-sm">{report.directorComments}</p>
          )}
          {(report.directorActionPoints || []).map((a, i) => (
            <p key={i} className="text-sm">
              • {a.action}
              {a.owner ? ` — ${a.owner}` : ""}
              {a.due ? ` (by ${a.due})` : ""}
            </p>
          ))}
        </section>
      )}

      {/* Signatures — this is a hard copy people file */}
      <section className="mt-8 grid grid-cols-2 gap-10 break-inside-avoid text-xs">
        <div>
          <div className="h-10 border-b border-zinc-400" />
          <p className="mt-1 text-zinc-600">
            {ROLE_LABEL[report.authorRole || "programme_manager"]} — signature &amp; date
          </p>
        </div>
        <div>
          <div className="h-10 border-b border-zinc-400" />
          <p className="mt-1 text-zinc-600">
            {variant.reviewerRole === "director" ? "Director" : "Programme Manager"} — signature &amp; date
          </p>
        </div>
      </section>
    </article>
  );
}
