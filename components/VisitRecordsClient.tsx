"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { useSettlements } from "@/lib/useSettlements";
import { PageHeaderBroadcast } from "./PageHeader";
import Pagination from "./Pagination";
import { Field, inputCls } from "./case-ui";
import { Icon } from "./icons";

type VisitedType = "school" | "anganwadi" | "health";
const TYPES: { key: VisitedType; label: string; hi: string }[] = [
  { key: "school", label: "School", hi: "स्कूल" },
  { key: "anganwadi", label: "Anganwadi", hi: "आंगनवाड़ी" },
  { key: "health", label: "Health facility", hi: "स्वास्थ्य केंद्र / डॉक्टर" },
];
const typeLabel = (k: string) => TYPES.find((t) => t.key === k)?.label ?? k;

interface Rec {
  id: string;
  visitDate: string;
  settlementCode: string | null;
  communityName: string;
  tolaAsTyped: string | null;
  visitedType: VisitedType;
  stakeholderNames: string | null;
  discussion: string;
  photoLinks: string[];
  remarks: string | null;
  schoolName: string | null;
  principalName: string | null;
  principalPhone: string | null;
  ashaName: string | null;
  ashaPhone: string | null;
  anmName: string | null;
  anmPhone: string | null;
  facilityName: string | null;
  doctorName: string | null;
  doctorPhone: string | null;
  cmName: string | null;
  source: "app" | "import";
  submittedAt: string;
  history: { at: string; by: string; note: string }[];
}
interface ListResp {
  records: Rec[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  summary: { visits: number; missingPhoto: number; byType: { key: string; label: string; visits: number }[] };
}
interface FormState {
  visitDate: string;
  settlementCode: string;
  visitedType: VisitedType | "";
  stakeholderNames: string;
  discussion: string;
  photoLinks: string;
  remarks: string;
  schoolName: string;
  principalName: string;
  principalPhone: string;
  ashaName: string;
  ashaPhone: string;
  anmName: string;
  anmPhone: string;
  facilityName: string;
  doctorName: string;
  doctorPhone: string;
}
const EMPTY: FormState = {
  visitDate: "", settlementCode: "", visitedType: "", stakeholderNames: "", discussion: "", photoLinks: "", remarks: "",
  schoolName: "", principalName: "", principalPhone: "", ashaName: "", ashaPhone: "", anmName: "", anmPhone: "",
  facilityName: "", doctorName: "", doctorPhone: "",
};
const todayStr = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const fromRec = (r: Rec): FormState => ({
  visitDate: r.visitDate, settlementCode: r.settlementCode ?? "", visitedType: r.visitedType,
  stakeholderNames: r.stakeholderNames ?? "", discussion: r.discussion, photoLinks: r.photoLinks.join("\n"), remarks: r.remarks ?? "",
  schoolName: r.schoolName ?? "", principalName: r.principalName ?? "", principalPhone: r.principalPhone ?? "",
  ashaName: r.ashaName ?? "", ashaPhone: r.ashaPhone ?? "", anmName: r.anmName ?? "", anmPhone: r.anmPhone ?? "",
  facilityName: r.facilityName ?? "", doctorName: r.doctorName ?? "", doctorPhone: r.doctorPhone ?? "",
});

/** The people-and-places lines of a record, for the list and the detail panel. */
function contactLines(r: Rec): [string, string][] {
  const phone = (n: string | null, p: string | null) => [n, p].filter(Boolean).join(" · ");
  const rows: [string, string | null][] =
    r.visitedType === "school"
      ? [["School", r.schoolName], ["Principal", phone(r.principalName, r.principalPhone)]]
      : r.visitedType === "anganwadi"
      ? [["ASHA", phone(r.ashaName, r.ashaPhone)], ["ANM", phone(r.anmName, r.anmPhone)]]
      : [["Facility", r.facilityName], ["Doctor", phone(r.doctorName, r.doctorPhone)]];
  return rows.filter((x): x is [string, string] => !!x[1]);
}

/**
 * Visit reports — the "Visited" Google Form. A CM files and sees their own;
 * MIS, Programme Manager and Director see everything and can correct any record.
 */
export default function VisitRecordsClient({ mode, canDelete = false }: { mode: "cm" | "staff"; canDelete?: boolean }) {
  const staff = mode === "staff";
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { settlements } = useSettlements(true);

  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [settlement, setSettlement] = useState("");
  const [type, setType] = useState("");
  const [cm, setCm] = useState("");
  const [noPhoto, setNoPhoto] = useState(false);
  const [qText, setQText] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [cms, setCms] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState<Rec | null>(null);
  const [form, setForm] = useState<{ id?: string; values: FormState } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    if (staff) apiFetch<{ cms: { id: string; name: string }[] }>("/api/cms").then((r) => setCms(r.cms)).catch(() => {});
  }, [staff]);
  useEffect(() => {
    const t = setTimeout(() => { setQ(qText.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [qText]);

  const filterQuery = useCallback(() => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (settlement) p.set("settlement", settlement);
    if (type) p.set("type", type);
    if (cm) p.set("cm", cm);
    if (noPhoto) p.set("evidence", "missing");
    if (q) p.set("q", q);
    return p.toString();
  }, [from, to, settlement, type, cm, noPhoto, q]);
  useEffect(() => { setPage(1); }, [from, to, settlement, type, cm, noPhoto]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiFetch<ListResp>(`/api/visit-records?${filterQuery()}&page=${page}&pageSize=100`));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [filterQuery, page]);
  useEffect(() => { load(); }, [load]);

  // Deep link from a notification: ?open=<id>
  const openParam = sp.get("open");
  useEffect(() => {
    if (!openParam) return;
    apiFetch<{ record: Rec }>(`/api/visit-records/${openParam}`).then((r) => setOpen(r.record)).catch((e) => setErr((e as Error).message));
  }, [openParam]);
  const closeDetail = () => {
    setOpen(null);
    if (sp.get("open")) router.replace(pathname, { scroll: false });
  };

  const hasFilters = !!(from || to || settlement || type || cm || noPhoto || q);
  const clear = () => { setFrom(""); setTo(""); setSettlement(""); setType(""); setCm(""); setNoPhoto(false); setQText(""); setQ(""); };
  const s = data?.summary;

  return (
    <div className="space-y-4">
      <PageHeaderBroadcast title="Visit reports" subtitle="Visits to schools, Anganwadis and health facilities" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {staff ? "Every visit report from the field — open one to correct it." : "आपकी भरी हुई रिपोर्टें · The visits you have filed."}
        </p>
        <button
          onClick={() => setForm({ values: { ...EMPTY, visitDate: todayStr() } })}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          + {staff ? "Add visit report" : "विज़िट रिपोर्ट भरें · Add report"}
        </button>
      </div>

      {flash && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">{flash}</p>}

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
        <Field label="From"><input type="date" className={inputCls} value={from} max={to || todayStr()} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input type="date" className={inputCls} value={to} min={from || undefined} max={todayStr()} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Community">
          <select className={inputCls} value={settlement} onChange={(e) => setSettlement(e.target.value)}>
            <option value="">All</option>
            {settlements.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
        <Field label="Visited">
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All</option>
            {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Field>
        {staff && (
          <Field label="Filed by">
            <select className={inputCls} value={cm} onChange={(e) => setCm(e.target.value)}>
              <option value="">All</option>
              {cms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Search"><input className={inputCls} value={qText} onChange={(e) => setQText(e.target.value)} placeholder="School, principal, ASHA, remarks…" /></Field>
        <label className="flex items-end gap-2 pb-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input type="checkbox" checked={noPhoto} onChange={(e) => setNoPhoto(e.target.checked)} />
          Missing photo link
        </label>
        {hasFilters && (
          <div className="flex items-end">
            <button onClick={clear} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">Clear filters</button>
          </div>
        )}
      </div>

      {s && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg bg-teal-50 px-3 py-1.5 font-semibold text-teal-800 dark:bg-teal-950/40 dark:text-teal-300">{s.visits.toLocaleString("en-IN")} {s.visits === 1 ? "visit" : "visits"}</span>
          {s.byType.map((t) => (
            <button key={t.key} onClick={() => setType(type === t.key ? "" : t.key)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${type === t.key ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300"}`}>
              {t.label} <span className="opacity-60">{t.visits}</span>
            </button>
          ))}
          {s.missingPhoto > 0 && (
            <button onClick={() => setNoPhoto(!noPhoto)} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {s.missingPhoto} missing photo link
            </button>
          )}
          {staff && s.visits > 0 && (
            <span className="ml-auto flex items-center gap-2">
              <a href={`/api/visit-records/export?${filterQuery()}`} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">⬇ Excel</a>
              <a href={`/api/visit-records/export?${filterQuery()}&format=csv`} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">⬇ CSV</a>
            </span>
          )}
        </div>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading && !data ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : data && data.records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {hasFilters ? "No visit reports match these filters." : staff ? "No visit reports yet." : "अभी कोई रिपोर्ट नहीं · You have not filed any visit report yet."}
        </div>
      ) : (
        <ul className={`space-y-2 ${loading ? "opacity-60" : ""}`}>
          {data?.records.map((r) => (
            <li key={r.id}>
              <button onClick={() => setOpen(r)} className="block w-full rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-teal-400 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">{r.communityName}</span>
                  <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800 dark:bg-teal-950/40 dark:text-teal-300">{typeLabel(r.visitedType)}</span>
                  <span className="text-xs text-zinc-400">{formatDate(r.visitDate)}</span>
                </div>
                {contactLines(r).length > 0 && (
                  <p className="mt-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">
                    {contactLines(r).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                  </p>
                )}
                <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-300">{r.discussion}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                  {staff && <span>{r.cmName ?? (r.source === "import" ? "Imported from Google Form" : "—")}</span>}
                  <span className={r.photoLinks.length ? "" : "font-semibold text-amber-600"}>{r.photoLinks.length ? `${r.photoLinks.length} photo link${r.photoLinks.length > 1 ? "s" : ""}` : "no photo"}</span>
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {data && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} busy={loading} onPage={(p) => { setPage(p); window.scrollTo({ top: 0, behavior: "smooth" }); }} />}

      {open && (
        <Detail
          r={open}
          staff={staff}
          canDelete={canDelete}
          onClose={closeDetail}
          onEdit={() => { setForm({ id: open.id, values: fromRec(open) }); closeDetail(); }}
          onDeleted={() => { closeDetail(); setFlash("Report deleted."); load(); }}
        />
      )}

      {form && (
        <RecordForm
          id={form.id}
          initial={form.values}
          staff={staff}
          settlements={settlements}
          onClose={() => setForm(null)}
          onSaved={(rec) => {
            setForm(null);
            setFlash(form.id ? "Saved." : staff ? "Report added." : "रिपोर्ट जमा हो गई · Report submitted. MIS, PM and Director can see it.");
            if (form.id) setOpen(rec);
            load();
          }}
        />
      )}
    </div>
  );
}

function Detail({ r, staff, canDelete, onClose, onEdit, onDeleted }: { r: Rec; staff: boolean; canDelete: boolean; onClose: () => void; onEdit: () => void; onDeleted: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const del = async () => {
    if (!window.confirm("Delete this report permanently?")) return;
    try { await apiFetch(`/api/visit-records/${r.id}`, { method: "DELETE" }); onDeleted(); } catch (e) { setErr((e as Error).message); }
  };
  const Row = ({ label, value }: { label: string; value: string | null }) =>
    value ? <div><p className="text-xs font-medium text-zinc-400">{label}</p><p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{value}</p></div> : null;
  return (
    <div className="fixed inset-0 z-40 print:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-xl dark:bg-zinc-950">
        <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <p className="text-xs text-zinc-400">{formatDate(r.visitDate)}</p>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{r.communityName}</h2>
            <p className="text-sm text-zinc-500">Visited: {typeLabel(r.visitedType)}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Close"><Icon.close /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm">
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
          {r.tolaAsTyped && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">The form said “{r.tolaAsTyped}”. Correct the community if it is wrong.</p>}
          {contactLines(r).map(([k, v]) => <Row key={k} label={k} value={v} />)}
          <Row label="People met" value={r.stakeholderNames} />
          <Row label="What was discussed" value={r.discussion} />
          <Row label="Remarks" value={r.remarks} />
          <div>
            <p className="text-xs font-medium text-zinc-400">Photos</p>
            {r.photoLinks.length === 0 ? (
              <p className="text-sm font-semibold text-amber-600">Not added</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {r.photoLinks.map((l, i) => (
                  <li key={l}><a href={l} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-teal-600 underline dark:text-teal-400">Open photo {r.photoLinks.length > 1 ? i + 1 : ""} ↗</a></li>
                ))}
              </ul>
            )}
          </div>
          <p className="text-xs text-zinc-400">Filed {formatDate(r.submittedAt)} by {r.cmName ?? (r.source === "import" ? "Google Form (imported)" : "—")}</p>
          {staff && (
            <div className="flex flex-wrap gap-2">
              <button onClick={onEdit} className="rounded-lg bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800">Edit</button>
              {canDelete && <button onClick={del} className="rounded-lg border border-red-300 px-3.5 py-2 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400">Delete</button>}
            </div>
          )}
          {r.history.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">History</p>
              <ul className="space-y-1 text-xs">{[...r.history].reverse().map((h, i) => (<li key={i}><span className="text-zinc-700 dark:text-zinc-200">{h.note}</span><span className="text-zinc-400"> · {formatDate(h.at)} · {h.by}</span></li>))}</ul>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function RecordForm({ id, initial, staff, settlements, onClose, onSaved }: {
  id?: string; initial: FormState; staff: boolean; settlements: { code: string; label: string }[]; onClose: () => void; onSaved: (r: Rec) => void;
}) {
  const [v, setV] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof FormState>(k: K, val: FormState[K]) => setV((p) => ({ ...p, [k]: val }));
  const hi = !staff;
  const L = (hiText: string, en: string, req = false) => `${hi ? `${hiText} · ` : ""}${en}${req ? " *" : ""}`;
  const text = (k: keyof FormState, label: string, props: { required?: boolean; placeholder?: string; type?: string } = {}) => (
    <Field label={label}>
      <input className={inputCls} value={v[k]} onChange={(e) => set(k, e.target.value)} maxLength={200} {...props} />
    </Field>
  );

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch<{ record: Rec }>(id ? `/api/visit-records/${id}` : "/api/visit-records", { method: id ? "PATCH" : "POST", body: JSON.stringify(v) });
      onSaved(r.record);
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 print:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form onSubmit={submit} className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-xl dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{id ? "Edit visit report" : hi ? "विज़िट रिपोर्ट · Visited" : "Add visit report"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Close"><Icon.close /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label={L("विज़िट की तारीख़", "Date of visit", true)}><input type="date" className={inputCls} value={v.visitDate} max={todayStr()} onChange={(e) => set("visitDate", e.target.value)} required /></Field>
            <Field label={L("टोला", "Name of tola", true)}>
              <select className={inputCls} value={v.settlementCode} onChange={(e) => set("settlementCode", e.target.value)} required>
                <option value="">Choose…</option>
                {settlements.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label={L("कहाँ गए", "Visited", true)}>
            <div className="grid grid-cols-3 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => set("visitedType", t.key)}
                  className={`rounded-lg border px-2 py-2.5 text-sm font-medium ${v.visitedType === t.key ? "border-teal-700 bg-teal-700 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"}`}
                >
                  {hi ? t.hi : t.label}
                </button>
              ))}
            </div>
          </Field>

          {v.visitedType === "school" && (
            <>
              {text("schoolName", L("स्कूल का नाम", "Name of school", true), { required: true })}
              <div className="grid grid-cols-2 gap-3">
                {text("principalName", L("प्रधानाध्यापक का नाम", "Name of principal"))}
                {text("principalPhone", L("प्रधानाध्यापक का नंबर", "Principal contact number"), { type: "tel" })}
              </div>
              {text("stakeholderNames", L("किससे मिले", "Stakeholders met"), { placeholder: "e.g. Principal, class teacher" })}
            </>
          )}
          {v.visitedType === "anganwadi" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {text("ashaName", L("आशा का नाम", "Name of ASHA"))}
                {text("ashaPhone", L("आशा का नंबर", "ASHA contact number"), { type: "tel" })}
                {text("anmName", L("ANM का नाम", "Name of ANM"))}
                {text("anmPhone", L("ANM का नंबर", "ANM contact number"), { type: "tel" })}
              </div>
              <p className="-mt-2 text-xs text-zinc-400">{hi ? "आशा या ANM में से कम से कम एक का नाम ज़रूरी है। · " : ""}Give at least the ASHA or the ANM.</p>
            </>
          )}
          {v.visitedType === "health" && (
            <>
              {text("facilityName", L("स्वास्थ्य केंद्र का नाम", "Name of health facility"))}
              <div className="grid grid-cols-2 gap-3">
                {text("doctorName", L("डॉक्टर का नाम", "Name of doctor"))}
                {text("doctorPhone", L("डॉक्टर का नंबर", "Doctor contact number"), { type: "tel" })}
              </div>
              <p className="-mt-2 text-xs text-zinc-400">{hi ? "डॉक्टर या केंद्र का नाम ज़रूरी है। · " : ""}Give the doctor or the facility.</p>
            </>
          )}

          {v.visitedType && (
            <>
              <Field label={L("क्या चर्चा हुई", "What have you discussed in the conversation?", true)}><textarea className={inputCls} rows={6} value={v.discussion} onChange={(e) => set("discussion", e.target.value)} required maxLength={8000} /></Field>
              <Field label={L("फ़ोटो का Drive लिंक", "Photo link(s)")}>
                <textarea className={inputCls} rows={2} value={v.photoLinks} onChange={(e) => set("photoLinks", e.target.value)} placeholder="https://drive.google.com/…  (one per line)" />
              </Field>
              <p className="-mt-2 text-xs text-zinc-400">{hi ? "Drive में फ़ाइल खोलकर ‘Share → Anyone with the link’ करें, फिर लिंक यहाँ चिपकाएँ। · " : ""}Upload to Google Drive, share “Anyone with the link”, paste the link here. Only Google Drive / Photos links are accepted.</p>
              <Field label={L("टिप्पणी", "Remarks")}><textarea className={inputCls} rows={3} value={v.remarks} onChange={(e) => set("remarks", e.target.value)} maxLength={4000} /></Field>
            </>
          )}
        </div>
        <div className="flex gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <button type="submit" disabled={busy || !v.visitedType} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">{busy ? "Saving…" : id ? "Save changes" : hi ? "जमा करें · Submit" : "Add report"}</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium dark:border-zinc-700">Cancel</button>
        </div>
      </form>
    </div>
  );
}
