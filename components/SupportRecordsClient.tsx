"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { useSettlements } from "@/lib/useSettlements";
import { REFERRALS, supportTypesFor } from "@/lib/support/schema";
import { PageHeaderBroadcast } from "./PageHeader";
import Pagination from "./Pagination";
import PrintButton from "./PrintButton";
import SupportForm, { emptySupport, type SupportFormValues } from "./SupportForm";
import { Field, inputCls } from "./case-ui";
import { Icon } from "./icons";

interface Rec {
  id: string;
  supportDate: string;
  settlementCode: string;
  communityName: string;
  referral: string;
  referralLabel: string;
  beneficiaryName: string;
  phone: string | null;
  supportTypes: string[];
  supportTypeLabels: string[];
  details: Record<string, string>;
  photoLinks: string[];
  status: "complete" | "follow_up_required";
  remarks: string | null;
  caseId: string | null;
  caseCode: string | null;
  householdId: string | null;
  linkStatus: "linked" | "suggested" | "unlinked";
  suggestions: { caseId: string; caseCode: string; householdId: string; name: string; score: number }[];
  verification: "not_needed" | "pending" | "verified" | "rejected";
  cmName: string | null;
  cmInferred: boolean;
  source: "app" | "import";
  submittedAt: string;
  history: { at: string; by: string; note: string }[];
}
interface Summary {
  total: number; complete: number; followUp: number; linked: number; suggested: number; unlinked: number; pendingVerification: number;
  byReferral: { key: string; label: string; count: number }[];
}
interface ListResp { records: Rec[]; total: number; page: number; pageSize: number; pages: number; summary: Summary }
interface ReportResp {
  groupLabel: string; note: string | null;
  rows: { label: string; total: number; complete: number; followUp: number; verified: number; pending: number; linked: number }[];
  totals: { total: number; complete: number; followUp: number; verified: number; pending: number; linked: number };
}

const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const GROUPS = [
  { key: "community", label: "Community" }, { key: "referral", label: "Referral" }, { key: "type", label: "Type of support" },
  { key: "month", label: "Month" }, { key: "cm", label: "Community Mobiliser" },
];

function StatusPill({ s }: { s: Rec["status"] }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s === "complete" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"}`}>{s === "complete" ? "Complete" : "Follow-up required"}</span>;
}
function VerifyPill({ v }: { v: Rec["verification"] }) {
  if (v === "not_needed") return null;
  const m = { pending: ["Awaiting verification", "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300"], verified: ["Verified", "bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300"], rejected: ["Sent back", "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"] }[v];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m[1]}`}>{m[0]}</span>;
}

/** Community Support & Follow-up: the CM files it; MIS, PM and Director verify, correct, link to cases and report. */
export default function SupportRecordsClient({ mode, canDelete = false }: { mode: "cm" | "staff"; canDelete?: boolean }) {
  const staff = mode === "staff";
  const hi = !staff;
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { settlements } = useSettlements(true);

  const [tab, setTab] = useState<"records" | "report">("records");
  const [page, setPage] = useState(1);
  const [f, setF] = useState({ from: "", to: "", settlement: "", referral: "", status: "", link: sp.get("link") ?? "", verification: sp.get("verification") ?? "", cm: "", q: "" });
  const [qText, setQText] = useState("");
  const [data, setData] = useState<ListResp | null>(null);
  const [report, setReport] = useState<ReportResp | null>(null);
  const [group, setGroup] = useState("community");
  const [cms, setCms] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Rec | null>(null);
  const [form, setForm] = useState<{ id?: string; values: SupportFormValues } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => { if (staff) apiFetch<{ cms: { id: string; name: string }[] }>("/api/cms").then((r) => setCms(r.cms)).catch(() => {}); }, [staff]);
  useEffect(() => { const t = setTimeout(() => { setF((p) => ({ ...p, q: qText.trim() })); setPage(1); }, 350); return () => clearTimeout(t); }, [qText]);

  const query = useCallback(() => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
    return p.toString();
  }, [f]);
  useEffect(() => { setPage(1); }, [f.from, f.to, f.settlement, f.referral, f.status, f.link, f.verification, f.cm]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "records") setData(await apiFetch<ListResp>(`/api/support-records?${query()}&page=${page}&pageSize=100`));
      else setReport(await apiFetch<ReportResp>(`/api/support-records/report?${query()}&group=${group}`));
      setErr(null);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [tab, query, page, group]);
  useEffect(() => { load(); }, [load]);

  const openParam = sp.get("open");
  useEffect(() => {
    if (!openParam) return;
    apiFetch<{ record: Rec }>(`/api/support-records/${openParam}`).then((r) => setOpen(r.record)).catch((e) => setErr((e as Error).message));
  }, [openParam]);
  const closeDetail = () => { setOpen(null); if (sp.get("open")) router.replace(pathname, { scroll: false }); };

  const hasFilters = Object.values(f).some(Boolean);
  const clear = () => { setF({ from: "", to: "", settlement: "", referral: "", status: "", link: "", verification: "", cm: "", q: "" }); setQText(""); };
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const s = data?.summary;

  return (
    <div className="space-y-4">
      <PageHeaderBroadcast title="Support & follow-up" subtitle="Documents, health, education and other support given to families" />
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
          {([["records", "Records"], ["report", "Report"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} className={`rounded-md px-4 py-1.5 text-sm font-medium ${tab === k ? "bg-teal-600 text-white" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"}`}>{l}</button>
          ))}
        </div>
        <button onClick={() => setForm({ values: emptySupport(today()) })} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">
          + {hi ? "सहायता फ़ॉर्म भरें · Fill support form" : "Add support record"}
        </button>
      </div>
      {flash && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300 print:hidden">{flash}</p>}

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6 print:hidden">
        <Field label="From"><input type="date" className={inputCls} value={f.from} max={f.to || today()} onChange={(e) => set("from", e.target.value)} /></Field>
        <Field label="To"><input type="date" className={inputCls} value={f.to} min={f.from || undefined} max={today()} onChange={(e) => set("to", e.target.value)} /></Field>
        <Field label="Community"><select className={inputCls} value={f.settlement} onChange={(e) => set("settlement", e.target.value)}><option value="">All</option>{settlements.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></Field>
        <Field label="Referral"><select className={inputCls} value={f.referral} onChange={(e) => set("referral", e.target.value)}><option value="">All</option>{REFERRALS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}</select></Field>
        <Field label="Status"><select className={inputCls} value={f.status} onChange={(e) => set("status", e.target.value)}><option value="">All</option><option value="complete">Complete</option><option value="follow_up_required">Follow-up required</option></select></Field>
        {staff && <Field label="Linked to a case"><select className={inputCls} value={f.link} onChange={(e) => set("link", e.target.value)}><option value="">All</option><option value="linked">Linked</option><option value="suggested">Needs confirming</option><option value="unlinked">Not linked</option></select></Field>}
        <Field label="Verification"><select className={inputCls} value={f.verification} onChange={(e) => set("verification", e.target.value)}><option value="">All</option><option value="pending">Awaiting verification</option><option value="verified">Verified</option><option value="rejected">Sent back</option></select></Field>
        {staff && <Field label="Community Mobiliser"><select className={inputCls} value={f.cm} onChange={(e) => set("cm", e.target.value)}><option value="">All</option><option value="none">Not recorded</option>{cms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></Field>}
        <Field label="Search"><input className={inputCls} value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Name, phone, case…" /></Field>
        {hasFilters && <div className="flex items-end"><button onClick={clear} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">Clear filters</button></div>}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {tab === "records" ? (
        <>
          {s && (
            <div className="flex flex-wrap items-center gap-2 text-sm print:hidden">
              <span className="rounded-lg bg-teal-50 px-3 py-1.5 font-semibold text-teal-800 dark:bg-teal-950/40 dark:text-teal-300">{s.total.toLocaleString("en-IN")} records</span>
              <button onClick={() => set("status", f.status === "complete" ? "" : "complete")} className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">Complete {s.complete}</button>
              <button onClick={() => set("status", f.status === "follow_up_required" ? "" : "follow_up_required")} className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">Follow-up required {s.followUp}</button>
              {s.pendingVerification > 0 && <button onClick={() => set("verification", f.verification === "pending" ? "" : "pending")} className="rounded-lg bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 dark:bg-violet-950/40 dark:text-violet-300">Awaiting verification {s.pendingVerification}</button>}
              {staff && s.suggested > 0 && <button onClick={() => set("link", f.link === "suggested" ? "" : "suggested")} className="rounded-lg bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800 dark:bg-sky-950/40 dark:text-sky-300">Needs confirming {s.suggested}</button>}
              {staff && s.unlinked > 0 && <span className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">Not linked to a case {s.unlinked}</span>}
              {staff && s.total > 0 && (
                <span className="ml-auto flex gap-2">
                  <a href={`/api/support-records/export?${query()}`} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">⬇ Excel</a>
                  <a href={`/api/support-records/export?${query()}&format=csv`} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">⬇ CSV</a>
                </span>
              )}
            </div>
          )}
          {loading && !data ? <p className="text-sm text-zinc-400">Loading…</p> : data && data.records.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
              {hasFilters ? "No records match these filters." : hi ? "अभी कोई रिकॉर्ड नहीं · No support records yet." : "No support records yet."}
            </div>
          ) : (
            <ul className={`space-y-2 ${loading ? "opacity-60" : ""}`}>
              {data?.records.map((r) => (
                <li key={r.id}>
                  <button onClick={() => setOpen(r)} className="block w-full rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-teal-400 dark:border-zinc-800 dark:bg-zinc-950">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-50">{r.beneficiaryName}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{r.referralLabel}</span>
                      <StatusPill s={r.status} /><VerifyPill v={r.verification} />
                      <span className="ml-auto text-xs text-zinc-400">{formatDate(r.supportDate)}</span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{r.supportTypeLabels.join(", ")} · {r.communityName}{r.phone ? ` · ${r.phone}` : ""}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                      {r.linkStatus === "linked" ? <span className="font-medium text-teal-700 dark:text-teal-400">Case {r.caseCode}</span> : r.linkStatus === "suggested" ? <span className="font-medium text-sky-700 dark:text-sky-400">{r.suggestions.length} possible case{r.suggestions.length === 1 ? "" : "s"} — needs confirming</span> : <span>not linked to a case</span>}
                      {r.cmName && <span>{r.cmName}{r.cmInferred ? " (community CM)" : ""}</span>}
                      {r.source === "import" && <span>from Google Sheet</span>}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {data && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} busy={loading} onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}
        </>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <Field label="Group by"><select className={inputCls} value={group} onChange={(e) => setGroup(e.target.value)}>{GROUPS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}</select></Field>
            <span className="ml-auto flex items-end gap-2 pt-5">
              {staff && <a href={`/api/support-records/export?${query()}`} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">⬇ Excel</a>}
              <PrintButton />
            </span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">Support & follow-up report</h2>
            <p className="text-sm text-zinc-500">{hasFilters ? Object.entries(f).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(" · ") : "All records"} · generated {formatDate(new Date().toISOString())}</p>
          </div>
          {report && (
            <table className="w-full border-collapse text-sm">
              <thead><tr className="bg-zinc-100 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                {[report.groupLabel, "Records", "Complete", "Follow-up required", "Verified", "Awaiting verification", "Linked to a case"].map((h, i) => <th key={h} className={`border border-zinc-200 px-3 py-2 dark:border-zinc-800 ${i ? "text-right" : ""}`}>{h}</th>)}
              </tr></thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.label} className="even:bg-zinc-50/60 dark:even:bg-zinc-900/40">
                    <td className="border border-zinc-200 px-3 py-1.5 dark:border-zinc-800">{r.label}</td>
                    {[r.total, r.complete, r.followUp, r.verified, r.pending, r.linked].map((n, i) => <td key={i} className="border border-zinc-200 px-3 py-1.5 text-right tabular-nums dark:border-zinc-800">{n.toLocaleString("en-IN")}</td>)}
                  </tr>
                ))}
                <tr className="bg-teal-50 font-semibold dark:bg-teal-950/30">
                  <td className="border border-zinc-200 px-3 py-2 dark:border-zinc-800">Total</td>
                  {Object.values(report.totals).map((n, i) => <td key={i} className="border border-zinc-200 px-3 py-2 text-right tabular-nums dark:border-zinc-800">{n.toLocaleString("en-IN")}</td>)}
                </tr>
              </tbody>
            </table>
          )}
          {report?.note && <p className="text-xs text-zinc-400">{report.note}</p>}
        </div>
      )}

      {open && (
        <Detail r={open} staff={staff} canDelete={canDelete} onClose={closeDetail}
          onChanged={(rec) => { setOpen(rec); load(); }}
          onEdit={() => {
            setForm({ id: open.id, values: { supportDate: open.supportDate, settlementCode: open.settlementCode, referral: open.referral, beneficiaryName: open.beneficiaryName, phone: open.phone ?? "", supportTypes: open.supportTypes, details: open.details, photoLinks: open.photoLinks.join("\n"), status: open.status, remarks: open.remarks ?? "" } });
            closeDetail();
          }}
          onDeleted={() => { closeDetail(); setFlash("Record deleted."); load(); }} />
      )}
      {form && (
        <SupportForm initial={form.values} hi={hi} editId={form.id} onClose={() => setForm(null)}
          onSaved={() => { setForm(null); setFlash(form.id ? "Saved." : hi ? "जमा हो गया · Submitted. MIS, PM and Director can see it." : "Record added."); load(); }} />
      )}
    </div>
  );
}

function Detail({ r, staff, canDelete, onClose, onEdit, onChanged, onDeleted }: { r: Rec; staff: boolean; canDelete: boolean; onClose: () => void; onEdit: () => void; onChanged: (r: Rec) => void; onDeleted: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState("");
  const [found, setFound] = useState<{ id: string; caseId: string; subjectName: string | null; householdId: string }[]>([]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try {
      const out = await apiFetch<{ record: Rec }>(`/api/support-records/${r.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onChanged(out.record);
    } catch (e) {
      const m = (e as Error).message;
      if (/does not finish the case/.test(m) && window.confirm(`${m}\n\nClose the case anyway?`)) return act({ ...body, force: true });
      setErr(m);
    } finally { setBusy(false); }
  };
  const find = async () => {
    try {
      const x = await apiFetch<{ cases: { id: string; caseId: string; subjectName: string | null; householdId: string }[] }>(`/api/cases?q=${encodeURIComponent(code)}&module=${r.referral}&status=open&pageSize=8`);
      setFound(x.cases);
    } catch (e) { setErr((e as Error).message); }
  };
  const del = async () => {
    if (!window.confirm("Delete this record permanently?")) return;
    try { await apiFetch(`/api/support-records/${r.id}`, { method: "DELETE" }); onDeleted(); } catch (e) { setErr((e as Error).message); }
  };
  const canClose = r.status === "complete";

  return (
    <div className="fixed inset-0 z-40 print:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-xl dark:bg-zinc-950">
        <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <p className="text-xs text-zinc-400">{formatDate(r.supportDate)} · {r.communityName}</p>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{r.beneficiaryName}</h2>
            <p className="mt-1 flex flex-wrap gap-2"><StatusPill s={r.status} /><VerifyPill v={r.verification} /></p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Close"><Icon.close /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm">
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
          <dl className="grid grid-cols-[8rem_1fr] gap-y-2">
            <dt className="text-zinc-400">Referral</dt><dd>{r.referralLabel}</dd>
            <dt className="text-zinc-400">Type of support</dt><dd>{r.supportTypeLabels.join(", ")}</dd>
            {r.phone && (<><dt className="text-zinc-400">Phone</dt><dd>{r.phone}</dd></>)}
            {Object.entries(r.details).map(([k, v]) => (<><dt key={k} className="text-zinc-400 capitalize">{k.replace(/_/g, " ")}</dt><dd key={k + "v"}>{v}</dd></>))}
            <dt className="text-zinc-400">Case</dt><dd>{r.caseCode ? `${r.caseCode}${r.householdId ? ` · ${r.householdId}` : ""}` : "not linked"}</dd>
            <dt className="text-zinc-400">Filed by</dt><dd>{r.cmName ? `${r.cmName}${r.cmInferred ? " (CM of this community)" : ""}` : "—"}{r.source === "import" ? " · from Google Sheet" : ""}</dd>
          </dl>
          {r.remarks && <div><p className="text-xs font-medium text-zinc-400">Remarks</p><p className="whitespace-pre-wrap">{r.remarks}</p></div>}
          <div><p className="text-xs font-medium text-zinc-400">Photo / proof</p>
            {r.photoLinks.length ? <ul className="mt-1 space-y-1">{r.photoLinks.map((l, i) => <li key={l}><a href={l} target="_blank" rel="noopener noreferrer" className="font-medium text-teal-600 underline dark:text-teal-400">Open photo {r.photoLinks.length > 1 ? i + 1 : ""} ↗</a></li>)}</ul> : <p className="font-semibold text-amber-600">Not added</p>}
          </div>

          {staff && r.linkStatus !== "linked" && (
            <section className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900/50 dark:bg-sky-950/20">
              <h3 className="font-semibold text-sky-900 dark:text-sky-200">Which case is this?</h3>
              <p className="mt-0.5 text-xs text-sky-800 dark:text-sky-300">Matched by community and name. Nothing is changed until you confirm.</p>
              {r.suggestions.map((s) => (
                <div key={s.caseId} className="mt-2 rounded-lg bg-white p-3 dark:bg-zinc-900">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100">{s.caseCode} · {s.name} <span className="text-zinc-400">({s.householdId}, {Math.round(s.score * 100)}% match)</span></p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button disabled={busy} onClick={() => act({ action: "link", caseId: s.caseId })} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800">Link only</button>
                    {canClose && <button disabled={busy} onClick={() => act({ action: "link", caseId: s.caseId, close: true })} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">Link & close case</button>}
                  </div>
                </div>
              ))}
              <div className="mt-3 flex gap-2">
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Or search a case: ENT-0612 / name" className={inputCls} />
                <button onClick={find} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">Find</button>
              </div>
              {found.map((c) => (
                <div key={c.id} className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-white p-2 text-sm dark:bg-zinc-900">
                  <span>{c.caseId} · {c.subjectName} <span className="text-zinc-400">({c.householdId})</span></span>
                  <span className="flex gap-2"><button disabled={busy} onClick={() => act({ action: "link", caseId: c.id })} className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700">Link</button>{canClose && <button disabled={busy} onClick={() => act({ action: "link", caseId: c.id, close: true })} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Link & close</button>}</span>
                </div>
              ))}
            </section>
          )}
          {staff && r.linkStatus === "linked" && <button disabled={busy} onClick={() => act({ action: "unlink" })} className="text-xs text-zinc-400 underline">Unlink from {r.caseCode}</button>}

          {staff && (
            <div className="flex flex-wrap gap-2">
              <button onClick={onEdit} className="rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800">Edit</button>
              {canDelete && <button onClick={del} className="rounded-lg border border-red-300 px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400">Delete</button>}
            </div>
          )}
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">History</p>
            <ul className="space-y-1 text-xs">{[...r.history].reverse().map((h, i) => <li key={i}><span className="text-zinc-700 dark:text-zinc-200">{h.note}</span><span className="text-zinc-400"> · {formatDate(h.at)} · {h.by}</span></li>)}</ul></div>
        </div>
      </aside>
    </div>
  );
}

export { supportTypesFor };
