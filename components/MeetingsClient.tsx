"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { useSettlements } from "@/lib/useSettlements";
import { PageHeaderBroadcast } from "./PageHeader";
import Pagination from "./Pagination";
import CmPicker from "./CmPicker";
import { Field, inputCls } from "./case-ui";
import { Icon } from "./icons";

interface Meeting {
  id: string;
  meetingCode: string;
  title: string;
  typeKey: string;
  typeLabel: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  location: string;
  settlementCode: string | null;
  settlementLabel: string | null;
  agenda: string | null;
  expectedParticipants: number | null;
  notes: string | null;
  organiser: { id: string; name: string };
  taggedCms: { id: string; name: string }[];
  status: "scheduled" | "cancelled" | "completed";
  history: { at: string; by: string; note: string }[];
}
interface ListResp {
  meetings: Meeting[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
interface FormState {
  title: string;
  typeKey: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  settlementCode: string;
  agenda: string;
  expectedParticipants: string;
  notes: string;
  taggedCmIds: string[];
}
const EMPTY: FormState = {
  title: "", typeKey: "", description: "", date: "", startTime: "", endTime: "", location: "",
  settlementCode: "", agenda: "", expectedParticipants: "", notes: "", taggedCmIds: [],
};
const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
] as const;
const todayStr = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

/** Community meetings. A CM creates and tags any number of other CMs; office roles read. */
export default function MeetingsClient({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { settlements } = useSettlements(true);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("upcoming");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [types, setTypes] = useState<{ key: string; label: string }[]>([]);
  const [me, setMe] = useState<string>("");
  const [openM, setOpenM] = useState<Meeting | null>(null);
  const [form, setForm] = useState<{ mode: "create" | "edit"; id?: string; values: FormState } | null>(null);

  useEffect(() => {
    apiFetch<{ items: { key: string; label: string }[] }>("/api/lookups?list=meeting_type").then((r) => setTypes(r.items)).catch(() => {});
    apiFetch<{ user: { id: string } }>("/api/auth/me").then((r) => setMe(r.user.id)).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (tab === "cancelled") q.set("status", "cancelled");
    else {
      q.set("when", tab);
      if (tab === "upcoming") q.set("status", "scheduled");
    }
    try {
      setData(await apiFetch<ListResp>(`/api/meetings?${q}`));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab, page]);
  useEffect(() => {
    load();
  }, [load]);

  const openParam = sp.get("open");
  useEffect(() => {
    if (!openParam) return;
    apiFetch<{ meeting: Meeting }>(`/api/meetings/${openParam}`).then((r) => setOpenM(r.meeting)).catch((e) => setErr((e as Error).message));
  }, [openParam]);
  const closeDetail = () => {
    setOpenM(null);
    if (sp.get("open")) router.replace(pathname, { scroll: false });
  };

  return (
    <div className="space-y-4">
      <PageHeaderBroadcast title="Planned meetings" subtitle="Plan an upcoming meeting and tag colleagues to help" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setPage(1); }}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === t.key ? "bg-teal-600 text-white" : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        {canCreate && (
          <button
            onClick={() => setForm({ mode: "create", values: { ...EMPTY, typeKey: types[0]?.key ?? "" } })}
            className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            + New meeting
          </button>
        )}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading && !data ? (
        <p className="text-sm text-zinc-400">Loading meetings…</p>
      ) : data && data.meetings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400 dark:border-zinc-700">
          No {tab} meetings.{canCreate && tab === "upcoming" && " Use “New meeting” to organise one."}
        </div>
      ) : (
        <ul className={`space-y-2 ${loading ? "opacity-60" : ""}`}>
          {data?.meetings.map((m) => (
            <li key={m.id}>
              <button
                onClick={() => setOpenM(m)}
                className="flex w-full items-start gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-teal-400 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300">
                  <span className="text-[10px] font-semibold uppercase">
                    {new Date(`${m.date}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}
                  </span>
                  <span className="text-lg font-bold leading-none">{m.date.slice(8)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">{m.title}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{m.typeLabel}</span>
                    {m.status !== "scheduled" && (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-semibold capitalize text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">{m.status}</span>
                    )}
                    {me && m.taggedCms.some((c) => c.id === me) && (
                      <span className="rounded-full bg-teal-100 px-2 py-0.5 text-[11px] font-semibold text-teal-700 dark:bg-teal-950/60 dark:text-teal-300">You are tagged</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-zinc-500 dark:text-zinc-400">
                    {m.startTime ? `${m.startTime}${m.endTime ? `–${m.endTime}` : ""} · ` : ""}
                    {m.location}
                    {m.settlementLabel ? ` · ${m.settlementLabel}` : ""}
                  </span>
                  <span className="mt-1 block text-xs text-zinc-400">
                    {m.meetingCode} · organised by {m.organiser.name}
                    {m.taggedCms.length > 0 && ` · with ${m.taggedCms.map((c) => c.name).join(", ")}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {data && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} busy={loading} onPage={setPage} />}

      {form && (
        <MeetingForm
          mode={form.mode}
          id={form.id}
          initial={form.values}
          types={types}
          settlements={settlements}
          myId={me}
          onClose={() => setForm(null)}
          onSaved={(m) => { setForm(null); setOpenM(m); load(); }}
        />
      )}

      {openM && (
        <aside className="fixed inset-0 z-40 print:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeDetail} />
          <MeetingDetail
            m={openM}
            isOrganiser={!!me && me === openM.organiser.id}
            onClose={closeDetail}
            onEdit={() => {
              setForm({
                mode: "edit",
                id: openM.id,
                values: {
                  title: openM.title, typeKey: openM.typeKey, description: openM.description ?? "", date: openM.date,
                  startTime: openM.startTime ?? "", endTime: openM.endTime ?? "", location: openM.location,
                  settlementCode: openM.settlementCode ?? "", agenda: openM.agenda ?? "",
                  expectedParticipants: openM.expectedParticipants == null ? "" : String(openM.expectedParticipants),
                  notes: openM.notes ?? "", taggedCmIds: openM.taggedCms.map((c) => c.id),
                },
              });
              closeDetail();
            }}
            onChanged={(m) => { setOpenM(m); load(); }}
          />
        </aside>
      )}
    </div>
  );
}

function MeetingDetail({
  m, isOrganiser, onClose, onEdit, onChanged,
}: {
  m: Meeting; isOrganiser: boolean; onClose: () => void; onEdit: () => void; onChanged: (m: Meeting) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (body: unknown) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ meeting: Meeting }>(`/api/meetings/${m.id}`, { method: "PATCH", body: JSON.stringify(body) });
      onChanged(r.meeting);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-xl dark:bg-zinc-950">
      <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <div>
          <p className="font-mono text-xs text-zinc-400">{m.meetingCode}</p>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{m.title}</h2>
          <p className="text-sm text-zinc-500">{m.typeLabel} · <span className="capitalize">{m.status}</span></p>
        </div>
        <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Close"><Icon.close /></button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm">
        {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
        <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
          <dt className="text-zinc-400">When</dt>
          <dd className="text-zinc-800 dark:text-zinc-100">{formatDate(m.date)}{m.startTime ? ` · ${m.startTime}${m.endTime ? `–${m.endTime}` : ""}` : ""}</dd>
          <dt className="text-zinc-400">Where</dt><dd className="text-zinc-800 dark:text-zinc-100">{m.location}</dd>
          {m.settlementLabel && (<><dt className="text-zinc-400">Community</dt><dd>{m.settlementLabel}</dd></>)}
          <dt className="text-zinc-400">Organiser</dt><dd>{m.organiser.name}</dd>
          <dt className="text-zinc-400">Helping</dt><dd>{m.taggedCms.length ? m.taggedCms.map((c) => c.name).join(", ") : "—"}</dd>
          {m.expectedParticipants != null && (<><dt className="text-zinc-400">Expected</dt><dd>{m.expectedParticipants} people</dd></>)}
        </dl>
        {m.description && (<div><p className="text-xs font-medium text-zinc-400">Description</p><p className="whitespace-pre-wrap">{m.description}</p></div>)}
        {m.agenda && (<div><p className="text-xs font-medium text-zinc-400">Agenda</p><p className="whitespace-pre-wrap">{m.agenda}</p></div>)}
        {m.notes && (<div><p className="text-xs font-medium text-zinc-400">Notes</p><p className="whitespace-pre-wrap">{m.notes}</p></div>)}
        {isOrganiser && m.status === "scheduled" && (
          <div className="flex flex-wrap gap-2">
            <button onClick={onEdit} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">Edit</button>
            <button onClick={() => act({ action: "complete" })} disabled={busy} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900">Mark held</button>
            <button
              onClick={() => {
                const reason = window.prompt("Reason for cancelling (sent to everyone involved):", "");
                if (reason !== null) act({ action: "cancel", reason });
              }}
              disabled={busy}
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
            >
              Cancel meeting
            </button>
          </div>
        )}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">History</p>
          <ul className="space-y-1.5 text-xs">
            {[...m.history].reverse().map((h, i) => (
              <li key={i}><span className="text-zinc-700 dark:text-zinc-200">{h.note}</span><span className="text-zinc-400"> · {formatDate(h.at)} · {h.by}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function MeetingForm({
  mode, id, initial, types, settlements, myId, onClose, onSaved,
}: {
  mode: "create" | "edit"; id?: string; initial: FormState; types: { key: string; label: string }[];
  settlements: { code: string; label: string }[]; myId: string; onClose: () => void; onSaved: (m: Meeting) => void;
}) {
  const [v, setV] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof FormState>(k: K, val: FormState[K]) => setV((p) => ({ ...p, [k]: val }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ meeting: Meeting }>(mode === "create" ? "/api/meetings" : `/api/meetings/${id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        body: JSON.stringify(v),
      });
      onSaved(r.meeting);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 print:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <form onSubmit={submit} className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-xl dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{mode === "create" ? "New community meeting" : "Edit meeting"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Close"><Icon.close /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
          <Field label="Meeting title *"><input className={inputCls} value={v.title} onChange={(e) => set("title", e.target.value)} required maxLength={140} /></Field>
          <Field label="Meeting type *">
            <select className={inputCls} value={v.typeKey} onChange={(e) => set("typeKey", e.target.value)} required>
              <option value="">Choose…</option>
              {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date *"><input type="date" className={inputCls} value={v.date} min={mode === "create" ? todayStr() : undefined} onChange={(e) => set("date", e.target.value)} required /></Field>
            <Field label="Start time"><input type="time" className={inputCls} value={v.startTime} onChange={(e) => set("startTime", e.target.value)} /></Field>
            <Field label="End time"><input type="time" className={inputCls} value={v.endTime} onChange={(e) => set("endTime", e.target.value)} /></Field>
          </div>
          <Field label="Location *"><input className={inputCls} value={v.location} onChange={(e) => set("location", e.target.value)} required maxLength={200} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Community">
              <select className={inputCls} value={v.settlementCode} onChange={(e) => set("settlementCode", e.target.value)}>
                <option value="">—</option>
                {settlements.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Expected participants"><input type="number" min={0} className={inputCls} value={v.expectedParticipants} onChange={(e) => set("expectedParticipants", e.target.value)} /></Field>
          </div>
          <Field label="Agenda"><textarea className={inputCls} rows={3} value={v.agenda} onChange={(e) => set("agenda", e.target.value)} maxLength={3000} /></Field>
          <Field label="Description"><textarea className={inputCls} rows={2} value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} /></Field>
          <Field label="Other information"><textarea className={inputCls} rows={2} value={v.notes} onChange={(e) => set("notes", e.target.value)} maxLength={2000} /></Field>
          <CmPicker label="Tag CMs to help (any number)" value={v.taggedCmIds} onChange={(ids) => set("taggedCmIds", ids)} excludeId={myId} />
          <p className="text-xs text-zinc-400">MIS, the Programme Manager, the Director and everyone you tag are notified.</p>
        </div>
        <div className="flex gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <button type="submit" disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
            {busy ? "Saving…" : mode === "create" ? "Create meeting" : "Save changes"}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium dark:border-zinc-700">Cancel</button>
        </div>
      </form>
    </div>
  );
}
