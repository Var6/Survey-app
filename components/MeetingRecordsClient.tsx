"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { useSettlements } from "@/lib/useSettlements";
import { PageHeaderBroadcast } from "./PageHeader";
import Pagination from "./Pagination";
import { Field, inputCls } from "./case-ui";
import { Icon } from "./icons";

interface Rec {
  id: string;
  meetingDate: string;
  settlementCode: string | null;
  communityName: string;
  typeKey: string;
  typeLabel: string;
  kind: "meeting" | "camp";
  topic: string;
  attendanceLinks: string[];
  totalParticipants: number | null;
  photoLinks: string[];
  remarks: string | null;
  stakeholderType: string | null;
  stakeholderTypeLabel: string | null;
  stakeholderName: string | null;
  participantNotes: string | null;
  cmName: string | null;
  cmInferred?: boolean;
  source: "app" | "import";
  submittedAt: string;
  history: { at: string; by: string; note: string }[];
}
interface Summary {
  meetings: number;
  participants: number;
  missingEvidence: number;
  byType: { key: string; label: string; meetings: number; participants: number }[];
  byStakeholder?: { key: string; label: string; count: number }[];
}
interface ListResp {
  records: Rec[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  summary: Summary;
}
interface FormState {
  meetingDate: string;
  settlementCode: string;
  typeKey: string;
  topic: string;
  totalParticipants: string;
  attendanceLinks: string;
  photoLinks: string;
  remarks: string;
  stakeholderType: string;
  stakeholderName: string;
  participantNotes: string;
}
const EMPTY: FormState = {
  meetingDate: "", settlementCode: "", typeKey: "", topic: "", totalParticipants: "",
  attendanceLinks: "", photoLinks: "", remarks: "", stakeholderType: "", stakeholderName: "", participantNotes: "",
};

/** The two forms share one screen; only the wording and a few fields differ. */
const CFG = {
  meeting: {
    title: "Meeting reports",
    subtitle: "Youth and women's community meetings",
    noun: "meeting",
    nounPlural: "meetings",
    typeList: "meeting_form_type",
    typeLabel: "Type of meeting",
    typeLabelHi: "बैठक का प्रकार",
    dateLabel: "Meeting date",
    dateLabelHi: "बैठक की तारीख़",
    topicLabel: "Topic discussed",
    topicLabelHi: "चर्चा का विषय",
    attLabel: "Attendance sheet",
    attLabelHi: "उपस्थिति शीट",
    addBtn: "Add meeting report",
    addBtnHi: "बैठक रिपोर्ट भरें · Add report",
    formTitle: "Add meeting report",
    formTitleHi: "बैठक रिपोर्ट · Community meeting",
    emptyCm: "अभी कोई रिपोर्ट नहीं · You have not filed any meeting report yet.",
    done: "रिपोर्ट जमा हो गई · Report submitted. MIS, PM and Director can see it.",
    exportKind: "meeting",
  },
  camp: {
    title: "Camp reports",
    subtitle: "Community camps run with Government, NGO and other partners",
    noun: "camp",
    nounPlural: "camps",
    typeList: "camp_form_type",
    typeLabel: "Type of camp",
    typeLabelHi: "कैंप का प्रकार",
    dateLabel: "Date of camp",
    dateLabelHi: "कैंप की तारीख़",
    topicLabel: "Support given at the camp",
    topicLabelHi: "कैंप में क्या सहायता दी गई",
    attLabel: "Attendance photo",
    attLabelHi: "उपस्थिति की फ़ोटो",
    addBtn: "Add camp report",
    addBtnHi: "कैंप रिपोर्ट भरें · Add report",
    formTitle: "Add camp report",
    formTitleHi: "कैंप रिपोर्ट · Community camp",
    emptyCm: "अभी कोई रिपोर्ट नहीं · You have not filed any camp report yet.",
    done: "रिपोर्ट जमा हो गई · Report submitted. MIS, PM and Director can see it.",
    exportKind: "camp",
  },
} as const;
type Kind = keyof typeof CFG;
const todayStr = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/**
 * Meeting reports — the old Google Form. A CM files and sees their own;
 * MIS, Programme Manager and Director see everything and can correct any record.
 */
export default function MeetingRecordsClient({
  mode,
  kind = "meeting",
  canDelete = false,
}: {
  mode: "cm" | "staff";
  kind?: Kind;
  canDelete?: boolean;
}) {
  const staff = mode === "staff";
  const cfg = CFG[kind];
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
  const [evidence, setEvidence] = useState(false);
  const [qText, setQText] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [types, setTypes] = useState<{ key: string; label: string }[]>([]);
  const [stakeTypes, setStakeTypes] = useState<{ key: string; label: string }[]>([]);
  const [stake, setStake] = useState("");
  const [cms, setCms] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState<Rec | null>(null);
  const [form, setForm] = useState<{ id?: string; values: FormState } | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  const loadTypes = useCallback(
    () => apiFetch<{ items: { key: string; label: string }[] }>(`/api/lookups?list=${cfg.typeList}`).then((r) => setTypes(r.items)).catch(() => {}),
    [cfg.typeList]
  );
  useEffect(() => {
    loadTypes();
    if (kind === "camp") apiFetch<{ items: { key: string; label: string }[] }>("/api/lookups?list=camp_stakeholder_type").then((r) => setStakeTypes(r.items)).catch(() => {});
    if (staff) apiFetch<{ cms: { id: string; name: string }[] }>("/api/cms").then((r) => setCms(r.cms)).catch(() => {});
  }, [loadTypes, staff, kind]);

  useEffect(() => {
    const t = setTimeout(() => { setQ(qText.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [qText]);

  const filterQuery = useCallback(() => {
    const p = new URLSearchParams({ kind });
    if (stake) p.set("stakeholder", stake);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (settlement) p.set("settlement", settlement);
    if (type) p.set("type", type);
    if (cm) p.set("cm", cm);
    if (evidence) p.set("evidence", "missing");
    if (q) p.set("q", q);
    return p.toString();
  }, [kind, stake, from, to, settlement, type, cm, evidence, q]);

  useEffect(() => { setPage(1); }, [from, to, settlement, type, cm, evidence, stake]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await apiFetch<ListResp>(`/api/meeting-records?${filterQuery()}&page=${page}&pageSize=100`));
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
    apiFetch<{ record: Rec }>(`/api/meeting-records/${openParam}`).then((r) => setOpen(r.record)).catch((e) => setErr((e as Error).message));
  }, [openParam]);
  const closeDetail = () => {
    setOpen(null);
    if (sp.get("open")) router.replace(pathname, { scroll: false });
  };

  const hasFilters = !!(from || to || settlement || type || cm || evidence || q || stake);
  const clear = () => { setFrom(""); setTo(""); setSettlement(""); setType(""); setCm(""); setEvidence(false); setQText(""); setQ(""); setStake(""); };
  const s = data?.summary;

  return (
    <div className="space-y-4">
      <PageHeaderBroadcast title={cfg.title} subtitle={cfg.subtitle} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-500">
          {staff ? `Every ${cfg.noun} report from the field — open one to correct it.` : `आपकी भरी हुई रिपोर्टें · The ${cfg.nounPlural} you have filed.`}
        </p>
        <button
          onClick={() => setForm({ values: { ...EMPTY, meetingDate: todayStr(), typeKey: types[0]?.key ?? "" } })}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
        >
          + {staff ? cfg.addBtn : cfg.addBtnHi}
        </button>
      </div>

      {flash && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">{flash}</p>}

      {/* Filters */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
        <Field label="From"><input type="date" className={inputCls} value={from} max={to || todayStr()} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input type="date" className={inputCls} value={to} min={from || undefined} max={todayStr()} onChange={(e) => setTo(e.target.value)} /></Field>
        <Field label="Community">
          <select className={inputCls} value={settlement} onChange={(e) => setSettlement(e.target.value)}>
            <option value="">All</option>
            {settlements.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
          </select>
        </Field>
        <Field label={cfg.typeLabel}>
          <select className={inputCls} value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All</option>
            {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </Field>
        {kind === "camp" && (
          <Field label="Supported by">
            <select className={inputCls} value={stake} onChange={(e) => setStake(e.target.value)}>
              <option value="">All</option>
              {stakeTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
        )}
        {staff && (
          <Field label="Filed by">
            <select className={inputCls} value={cm} onChange={(e) => setCm(e.target.value)}>
              <option value="">All</option>
              {cms.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Search"><input className={inputCls} value={qText} onChange={(e) => setQText(e.target.value)} placeholder="Topic, remarks, community…" /></Field>
        <label className="flex items-end gap-2 pb-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input type="checkbox" checked={evidence} onChange={(e) => setEvidence(e.target.checked)} />
          Missing photo / attendance link
        </label>
        {hasFilters && (
          <div className="flex items-end">
            <button onClick={clear} className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900">Clear filters</button>
          </div>
        )}
      </div>

      {/* Summary of the filtered set */}
      {s && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg bg-teal-50 px-3 py-1.5 font-semibold text-teal-800 dark:bg-teal-950/40 dark:text-teal-300">{s.meetings.toLocaleString("en-IN")} {s.meetings === 1 ? cfg.noun : cfg.nounPlural}</span>
          <span className="rounded-lg bg-zinc-100 px-3 py-1.5 font-semibold text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{s.participants.toLocaleString("en-IN")} participants</span>
          {s.byType.map((t) => (
            <button key={t.key} onClick={() => setType(type === t.key ? "" : t.key)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${type === t.key ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300"}`}>
              {t.label} <span className="opacity-60">{t.meetings}</span>
            </button>
          ))}
          {kind === "camp" && s.byStakeholder?.map((t) => (
            <button key={t.key} onClick={() => setStake(stake === t.key ? "" : t.key)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${stake === t.key ? "bg-indigo-700 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300"}`}>
              {t.label} <span className="opacity-60">{t.count}</span>
            </button>
          ))}
          {s.missingEvidence > 0 && (
            <button onClick={() => setEvidence(!evidence)} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              {s.missingEvidence} missing photo / attendance link
            </button>
          )}
          {staff && s.meetings > 0 && (
            <span className="ml-auto flex items-center gap-2">
              <a href={`/api/meeting-records/export?${filterQuery()}`} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">⬇ Excel</a>
              <a href={`/api/meeting-records/export?${filterQuery()}&format=csv`} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">⬇ CSV</a>
            </span>
          )}
        </div>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading && !data ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : data && data.records.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {hasFilters ? `No ${cfg.noun} reports match these filters.` : staff ? `No ${cfg.noun} reports yet.` : cfg.emptyCm}
        </div>
      ) : (
        <ul className={`space-y-2 ${loading ? "opacity-60" : ""}`}>
          {data?.records.map((r) => (
            <li key={r.id}>
              <button onClick={() => setOpen(r)} className="block w-full rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-teal-400 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-zinc-900 dark:text-zinc-50">{r.communityName}</span>
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{r.typeLabel}</span>
                  <span className="text-xs text-zinc-400">{formatDate(r.meetingDate)}</span>
                  <span className="ml-auto text-sm font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">{r.totalParticipants ?? "—"} <span className="text-xs font-normal text-zinc-400">participants</span></span>
                </div>
                {r.kind === "camp" && r.stakeholderTypeLabel && (
                  <p className="mt-1 text-xs font-medium text-indigo-700 dark:text-indigo-300">{r.stakeholderTypeLabel}: {r.stakeholderName}</p>
                )}
                <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-sm text-zinc-600 dark:text-zinc-300">{r.topic}</p>
                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                  {staff && <span>{r.cmName ? `${r.cmName}${r.cmInferred ? " (community CM)" : ""}` : r.source === "import" ? "Imported from Google Form" : "—"}</span>}
                  <span className={r.attendanceLinks.length ? "" : "font-semibold text-amber-600"}>{r.attendanceLinks.length ? `${r.attendanceLinks.length} attendance sheet${r.attendanceLinks.length > 1 ? "s" : ""}` : "no attendance sheet"}</span>
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
          onEdit={() => {
            setForm({ id: open.id, values: {
              meetingDate: open.meetingDate, settlementCode: open.settlementCode ?? "", typeKey: open.typeKey, topic: open.topic,
              totalParticipants: open.totalParticipants == null ? "" : String(open.totalParticipants), attendanceLinks: open.attendanceLinks.join("\n"),
              photoLinks: open.photoLinks.join("\n"), remarks: open.remarks ?? "",
              stakeholderType: open.stakeholderType ?? "", stakeholderName: open.stakeholderName ?? "", participantNotes: open.participantNotes ?? "",
            } });
            closeDetail();
          }}
          onDeleted={() => { closeDetail(); setFlash("Report deleted."); load(); }}
          cfg={cfg}
        />
      )}

      {form && (
        <RecordForm
          kind={kind}
          cfg={cfg}
          stakeTypes={stakeTypes}
          onStakeTypesChanged={() => apiFetch<{ items: { key: string; label: string }[] }>("/api/lookups?list=camp_stakeholder_type").then((r) => setStakeTypes(r.items)).catch(() => {})}
          id={form.id}
          initial={form.values}
          staff={staff}
          types={types}
          settlements={settlements}
          onTypesChanged={loadTypes}
          onClose={() => setForm(null)}
          onSaved={(rec) => {
            setForm(null);
            setFlash(form.id ? "Saved." : staff ? "Report added." : cfg.done);
            if (form.id) setOpen(rec);
            load();
          }}
        />
      )}
    </div>
  );
}

function LinkList({ label, links }: { label: string; links: string[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-400">{label}</p>
      {links.length === 0 ? (
        <p className="text-sm font-semibold text-amber-600">Not added</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {links.map((l, i) => (
            <li key={l}>
              <a href={l} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-teal-600 underline dark:text-teal-400">
                Open {label.toLowerCase()} {links.length > 1 ? i + 1 : ""} ↗
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Detail({ r, staff, canDelete, cfg, onClose, onEdit, onDeleted }: { r: Rec; staff: boolean; canDelete: boolean; cfg: (typeof CFG)[Kind]; onClose: () => void; onEdit: () => void; onDeleted: () => void }) {
  const [err, setErr] = useState<string | null>(null);
  const del = async () => {
    if (!window.confirm("Delete this report permanently?")) return;
    try { await apiFetch(`/api/meeting-records/${r.id}`, { method: "DELETE" }); onDeleted(); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <div className="fixed inset-0 z-40 print:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-xl dark:bg-zinc-950">
        <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <p className="text-xs text-zinc-400">{formatDate(r.meetingDate)}</p>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{r.communityName}</h2>
            <p className="text-sm text-zinc-500">{r.typeLabel} · {r.totalParticipants ?? "—"} participants</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Close"><Icon.close /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm">
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
          {r.kind === "camp" && (
            <div><p className="text-xs font-medium text-zinc-400">Supported by</p><p className="font-medium text-indigo-700 dark:text-indigo-300">{r.stakeholderTypeLabel ?? "—"}{r.stakeholderName ? ` · ${r.stakeholderName}` : ""}</p></div>
          )}
          <div><p className="text-xs font-medium text-zinc-400">{cfg.topicLabel}</p><p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{r.topic}</p></div>
          {r.participantNotes && <div><p className="text-xs font-medium text-zinc-400">Doctors / members who took part</p><p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{r.participantNotes}</p></div>}
          {r.remarks && <div><p className="text-xs font-medium text-zinc-400">Remarks</p><p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{r.remarks}</p></div>}
          <LinkList label={cfg.attLabel} links={r.attendanceLinks} />
          <LinkList label="Group photo" links={r.photoLinks} />
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

function RecordForm({ kind, cfg, stakeTypes, onStakeTypesChanged, id, initial, staff, types, settlements, onTypesChanged, onClose, onSaved }: {
  kind: Kind; cfg: (typeof CFG)[Kind]; stakeTypes: { key: string; label: string }[]; onStakeTypesChanged: () => void;
  id?: string; initial: FormState; staff: boolean; types: { key: string; label: string }[];
  settlements: { code: string; label: string }[]; onTypesChanged: () => void; onClose: () => void; onSaved: (r: Rec) => void;
}) {
  const [v, setV] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof FormState>(k: K, val: FormState[K]) => setV((p) => ({ ...p, [k]: val }));
  const hi = !staff;

  const addType = async () => {
    const label = window.prompt(`Name of the new ${cfg.noun} type:`);
    if (!label?.trim()) return;
    try {
      const r = await apiFetch<{ item: { key: string } }>("/api/lookups", { method: "POST", body: JSON.stringify({ list: cfg.typeList, label }) });
      onTypesChanged();
      set("typeKey", r.item.key);
    } catch (e) { setErr((e as Error).message); }
  };
  const addStake = async () => {
    const label = window.prompt("Name of the new kind of supporter (e.g. Corporate):");
    if (!label?.trim()) return;
    try {
      const r = await apiFetch<{ item: { key: string } }>("/api/lookups", { method: "POST", body: JSON.stringify({ list: "camp_stakeholder_type", label }) });
      onStakeTypesChanged();
      set("stakeholderType", r.item.key);
    } catch (e) { setErr((e as Error).message); }
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const r = await apiFetch<{ record: Rec }>(id ? `/api/meeting-records/${id}` : "/api/meeting-records", { method: id ? "PATCH" : "POST", body: JSON.stringify({ ...v, kind }) });
      onSaved(r.record);
    } catch (e2) { setErr((e2 as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 print:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form onSubmit={submit} className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-xl dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{id ? `Edit ${cfg.noun} report` : hi ? cfg.formTitleHi : cfg.formTitle}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Close"><Icon.close /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
          <div className="grid grid-cols-2 gap-3">
            <Field label={hi ? `${cfg.dateLabelHi} · ${cfg.dateLabel} *` : `${cfg.dateLabel} *`}><input type="date" className={inputCls} value={v.meetingDate} max={todayStr()} onChange={(e) => set("meetingDate", e.target.value)} required /></Field>
            <Field label={hi ? "कुल प्रतिभागी · Total participants *" : "Total participants *"}><input type="number" min={0} className={inputCls} value={v.totalParticipants} onChange={(e) => set("totalParticipants", e.target.value)} required /></Field>
          </div>
          <Field label={hi ? "समुदाय का नाम · Name of community *" : "Name of community *"}>
            <select className={inputCls} value={v.settlementCode} onChange={(e) => set("settlementCode", e.target.value)} required>
              <option value="">Choose…</option>
              {settlements.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <Field label={hi ? `${cfg.typeLabelHi} · ${cfg.typeLabel} *` : `${cfg.typeLabel} *`}>
              <select className={inputCls} value={v.typeKey} onChange={(e) => set("typeKey", e.target.value)} required>
                <option value="">Choose…</option>
                {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </Field>
            {staff && <button type="button" onClick={addType} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">+ Type</button>}
          </div>
          {kind === "camp" && (
            <>
              <div className="grid grid-cols-[1fr_auto] items-end gap-2">
                <Field label={hi ? "सहायता किसने दी · Supported by *" : "Supported by *"}>
                  <select className={inputCls} value={v.stakeholderType} onChange={(e) => set("stakeholderType", e.target.value)} required>
                    <option value="">Choose…</option>
                    {stakeTypes.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </Field>
                {staff && <button type="button" onClick={addStake} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">+ Type</button>}
              </div>
              <Field label={hi ? "संस्था / व्यक्ति का नाम · Name of the organisation or person *" : "Name of the organisation or person *"}>
                <input className={inputCls} value={v.stakeholderName} onChange={(e) => set("stakeholderName", e.target.value)} required maxLength={200} placeholder="e.g. UPHC Madhopara, Dr. Nagma" />
              </Field>
            </>
          )}
          <Field label={hi ? `${cfg.topicLabelHi} · ${cfg.topicLabel} *` : `${cfg.topicLabel} *`}><textarea className={inputCls} rows={6} value={v.topic} onChange={(e) => set("topic", e.target.value)} required maxLength={8000} /></Field>
          <Field label={hi ? `${cfg.attLabelHi} का Drive लिंक · ${cfg.attLabel} link(s)` : `${cfg.attLabel} link(s)`}>
            <textarea className={inputCls} rows={2} value={v.attendanceLinks} onChange={(e) => set("attendanceLinks", e.target.value)} placeholder="https://drive.google.com/…  (one per line)" />
          </Field>
          <Field label={hi ? "ग्रुप फ़ोटो का Drive लिंक · Group photo link(s)" : "Group photo link(s)"}>
            <textarea className={inputCls} rows={2} value={v.photoLinks} onChange={(e) => set("photoLinks", e.target.value)} placeholder="https://drive.google.com/…  (one per line)" />
          </Field>
          <p className="-mt-2 text-xs text-zinc-400">{hi ? "Drive में फ़ाइल खोलकर ‘Share → Anyone with the link’ करें, फिर लिंक यहाँ चिपकाएँ। · " : ""}Upload to Google Drive, share “Anyone with the link”, paste the link here. Only Google Drive / Photos links are accepted.</p>
          {kind === "camp" && (
            <Field label={hi ? "शामिल डॉक्टर / सदस्यों के नाम · Doctors / members who took part" : "Doctors / members who took part (names)"}>
              <textarea className={inputCls} rows={3} value={v.participantNotes} onChange={(e) => set("participantNotes", e.target.value)} maxLength={2000} />
            </Field>
          )}
          <Field label={hi ? "टिप्पणी · Remarks" : "Remarks"}><textarea className={inputCls} rows={3} value={v.remarks} onChange={(e) => set("remarks", e.target.value)} maxLength={4000} /></Field>
        </div>
        <div className="flex gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <button type="submit" disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">{busy ? "Saving…" : id ? "Save changes" : hi ? "जमा करें · Submit" : "Add report"}</button>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium dark:border-zinc-700">Cancel</button>
        </div>
      </form>
    </div>
  );
}
