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

interface Camp {
  id: string;
  campCode: string;
  name: string;
  typeKey: string;
  typeLabel: string;
  description: string | null;
  date: string;
  startTime: string | null;
  endTime: string | null;
  venue: string;
  settlementCode: string | null;
  settlementLabel: string | null;
  programme: string | null;
  responsibleName: string | null;
  assignedCms: { id: string; name: string }[];
  instructions: string | null;
  status: "scheduled" | "cancelled" | "completed";
  calendar: { status: string; htmlLink: string | null; lastError: string | null; attempts: number; syncedAt: string | null };
  history: { at: string; by: string; note: string }[];
  createdByName: string;
  createdAt: string;
}
interface ListResp {
  camps: Camp[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}
interface FormState {
  name: string;
  typeKey: string;
  description: string;
  date: string;
  startTime: string;
  endTime: string;
  venue: string;
  settlementCode: string;
  programme: string;
  responsibleName: string;
  instructions: string;
  assignedCmIds: string[];
}
const EMPTY: FormState = {
  name: "", typeKey: "", description: "", date: "", startTime: "", endTime: "", venue: "",
  settlementCode: "", programme: "", responsibleName: "", instructions: "", assignedCmIds: [],
};

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "past", label: "Past" },
  { key: "cancelled", label: "Cancelled" },
] as const;

const todayStr = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function CalendarBadge({ c }: { c: Camp["calendar"] }) {
  const map: Record<string, [string, string]> = {
    synced: ["On Google Calendar", "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"],
    cancelled: ["Removed from calendar", "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"],
    failed: ["Calendar sync failed", "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300"],
    not_configured: ["Calendar not connected", "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300"],
    pending: ["Calendar pending", "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"],
  };
  const [label, cls] = map[c.status] ?? map.pending;
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

export default function CampsClient({ canManage }: { canManage: boolean }) {
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
  const [openCamp, setOpenCamp] = useState<Camp | null>(null);
  const [form, setForm] = useState<{ mode: "create" | "edit"; id?: string; values: FormState } | null>(null);

  const loadTypes = useCallback(
    () => apiFetch<{ items: { key: string; label: string }[] }>("/api/lookups?list=camp_type").then((r) => setTypes(r.items)).catch(() => {}),
    []
  );
  useEffect(() => {
    loadTypes();
  }, [loadTypes]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (tab === "cancelled") q.set("status", "cancelled");
    else q.set("when", tab);
    if (tab !== "cancelled") q.set("status", tab === "upcoming" ? "scheduled" : "");
    if (!q.get("status")) q.delete("status");
    try {
      setData(await apiFetch<ListResp>(`/api/camps?${q}`));
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

  // Deep link from a notification: ?open=<campId>
  const openParam = sp.get("open");
  useEffect(() => {
    if (!openParam) return;
    apiFetch<{ camp: Camp }>(`/api/camps/${openParam}`).then((r) => setOpenCamp(r.camp)).catch((e) => setErr((e as Error).message));
  }, [openParam]);
  const closeDetail = () => {
    setOpenCamp(null);
    if (sp.get("open")) router.replace(pathname, { scroll: false });
  };

  const startEdit = (c: Camp) =>
    setForm({
      mode: "edit",
      id: c.id,
      values: {
        name: c.name, typeKey: c.typeKey, description: c.description ?? "", date: c.date,
        startTime: c.startTime ?? "", endTime: c.endTime ?? "", venue: c.venue,
        settlementCode: c.settlementCode ?? "", programme: c.programme ?? "",
        responsibleName: c.responsibleName ?? "", instructions: c.instructions ?? "",
        assignedCmIds: c.assignedCms.map((x) => x.id),
      },
    });

  return (
    <div className="space-y-4">
      <PageHeaderBroadcast title="Camps" subtitle="Health, documents and awareness camps" />
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
        {canManage && (
          <button
            onClick={() => setForm({ mode: "create", values: { ...EMPTY, typeKey: types[0]?.key ?? "" } })}
            className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            + New camp
          </button>
        )}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading && !data ? (
        <p className="text-sm text-zinc-400">Loading camps…</p>
      ) : data && data.camps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400 dark:border-zinc-700">
          {tab === "upcoming" ? "No upcoming camps." : tab === "past" ? "No past camps." : "No cancelled camps."}
          {canManage && tab === "upcoming" && " Use “New camp” to schedule one."}
        </div>
      ) : (
        <ul className={`space-y-2 ${loading ? "opacity-60" : ""}`}>
          {data?.camps.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => setOpenCamp(c)}
                className="flex w-full items-start gap-4 rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-teal-400 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300">
                  <span className="text-[10px] font-semibold uppercase">
                    {new Date(`${c.date}T00:00:00Z`).toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" })}
                  </span>
                  <span className="text-lg font-bold leading-none">{c.date.slice(8)}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-50">{c.name}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">{c.typeLabel}</span>
                    {c.status !== "scheduled" && (
                      <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-semibold capitalize text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200">{c.status}</span>
                    )}
                  </span>
                  <span className="mt-0.5 block text-sm text-zinc-500 dark:text-zinc-400">
                    {c.startTime ? `${c.startTime}${c.endTime ? `–${c.endTime}` : ""} · ` : ""}
                    {c.venue}
                    {c.settlementLabel ? ` · ${c.settlementLabel}` : ""}
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                    <span>{c.campCode}</span>
                    {c.assignedCms.length > 0 && <span>· {c.assignedCms.map((x) => x.name).join(", ")}</span>}
                    {canManage && <CalendarBadge c={c.calendar} />}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {data && <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={data.pageSize} busy={loading} onPage={setPage} />}

      {form && (
        <CampForm
          mode={form.mode}
          id={form.id}
          initial={form.values}
          types={types}
          settlements={settlements}
          onTypesChanged={loadTypes}
          onClose={() => setForm(null)}
          onSaved={(c) => {
            setForm(null);
            setOpenCamp(c);
            load();
          }}
        />
      )}

      {openCamp && (
        <CampDetail
          camp={openCamp}
          canManage={canManage}
          onClose={closeDetail}
          onEdit={() => { startEdit(openCamp); closeDetail(); }}
          onChanged={(c) => { setOpenCamp(c); load(); }}
        />
      )}
    </div>
  );
}

function CampDetail({
  camp,
  canManage,
  onClose,
  onEdit,
  onChanged,
}: {
  camp: Camp;
  canManage: boolean;
  onClose: () => void;
  onEdit: () => void;
  onChanged: (c: Camp) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const act = async (url: string, method: string, body?: unknown) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ camp: Camp }>(url, { method, body: body ? JSON.stringify(body) : undefined });
      onChanged(r.camp);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const cancel = () => {
    const reason = window.prompt("Reason for cancelling (shown to everyone notified):", "");
    if (reason === null) return;
    act(`/api/camps/${camp.id}`, "PATCH", { action: "cancel", reason });
  };

  return (
    <div className="fixed inset-0 z-40 print:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-xl dark:bg-zinc-950">
        <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <p className="font-mono text-xs text-zinc-400">{camp.campCode}</p>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{camp.name}</h2>
            <p className="text-sm text-zinc-500">{camp.typeLabel} · <span className="capitalize">{camp.status}</span></p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Close"><Icon.close /></button>
        </div>
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5 text-sm">
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
          <dl className="grid grid-cols-[7rem_1fr] gap-y-2">
            <dt className="text-zinc-400">When</dt>
            <dd className="text-zinc-800 dark:text-zinc-100">{formatDate(camp.date)}{camp.startTime ? ` · ${camp.startTime}${camp.endTime ? `–${camp.endTime}` : ""}` : ""}</dd>
            <dt className="text-zinc-400">Venue</dt><dd className="text-zinc-800 dark:text-zinc-100">{camp.venue}</dd>
            {camp.settlementLabel && (<><dt className="text-zinc-400">Community</dt><dd>{camp.settlementLabel}</dd></>)}
            {camp.programme && (<><dt className="text-zinc-400">Programme</dt><dd>{camp.programme}</dd></>)}
            {camp.responsibleName && (<><dt className="text-zinc-400">Responsible</dt><dd>{camp.responsibleName}</dd></>)}
            <dt className="text-zinc-400">Assigned CMs</dt>
            <dd>{camp.assignedCms.length ? camp.assignedCms.map((c) => c.name).join(", ") : "—"}</dd>
            <dt className="text-zinc-400">Created by</dt><dd>{camp.createdByName}</dd>
          </dl>
          {camp.description && (<div><p className="text-xs font-medium text-zinc-400">Description</p><p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{camp.description}</p></div>)}
          {camp.instructions && (<div><p className="text-xs font-medium text-zinc-400">Instructions</p><p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{camp.instructions}</p></div>)}

          {canManage && (
            <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CalendarBadge c={camp.calendar} />
                {camp.calendar.htmlLink && (
                  <a href={camp.calendar.htmlLink} target="_blank" rel="noreferrer" className="text-xs font-medium text-teal-600 underline">Open in Google Calendar</a>
                )}
              </div>
              {camp.calendar.lastError && camp.calendar.status !== "synced" && (
                <p className="mt-2 text-xs text-zinc-500">{camp.calendar.lastError}</p>
              )}
              {camp.calendar.status !== "synced" && camp.calendar.status !== "cancelled" && (
                <button
                  onClick={() => act(`/api/camps/${camp.id}/calendar`, "POST")}
                  disabled={busy}
                  className="mt-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
                >
                  {busy ? "Trying…" : "Retry calendar sync"}
                </button>
              )}
            </div>
          )}

          {canManage && camp.status === "scheduled" && (
            <div className="flex flex-wrap gap-2">
              <button onClick={onEdit} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">Edit</button>
              <button onClick={() => act(`/api/camps/${camp.id}`, "PATCH", { action: "complete" })} disabled={busy} className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900">Mark completed</button>
              <button onClick={cancel} disabled={busy} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400">Cancel camp</button>
            </div>
          )}

          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">History</p>
            <ul className="space-y-1.5 text-xs">
              {[...camp.history].reverse().map((h, i) => (
                <li key={i}><span className="text-zinc-700 dark:text-zinc-200">{h.note}</span><span className="text-zinc-400"> · {formatDate(h.at)} · {h.by}</span></li>
              ))}
            </ul>
          </div>
        </div>
      </aside>
    </div>
  );
}

function CampForm({
  mode,
  id,
  initial,
  types,
  settlements,
  onTypesChanged,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  id?: string;
  initial: FormState;
  types: { key: string; label: string }[];
  settlements: { code: string; label: string }[];
  onTypesChanged: () => void;
  onClose: () => void;
  onSaved: (c: Camp) => void;
}) {
  const [v, setV] = useState<FormState>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = <K extends keyof FormState>(k: K, val: FormState[K]) => setV((p) => ({ ...p, [k]: val }));

  const addType = async () => {
    const label = window.prompt("Name of the new camp type:");
    if (!label?.trim()) return;
    try {
      const r = await apiFetch<{ item: { key: string } }>("/api/lookups", {
        method: "POST",
        body: JSON.stringify({ list: "camp_type", label }),
      });
      onTypesChanged();
      set("typeKey", r.item.key);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ camp: Camp }>(mode === "create" ? "/api/camps" : `/api/camps/${id}`, {
        method: mode === "create" ? "POST" : "PATCH",
        body: JSON.stringify(v),
      });
      onSaved(r.camp);
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
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{mode === "create" ? "New camp" : "Edit camp"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900" aria-label="Close"><Icon.close /></button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
          <Field label="Camp name *"><input className={inputCls} value={v.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} /></Field>
          <div className="grid grid-cols-[1fr_auto] items-end gap-2">
            <Field label="Camp type *">
              <select className={inputCls} value={v.typeKey} onChange={(e) => set("typeKey", e.target.value)} required>
                <option value="">Choose…</option>
                {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </Field>
            <button type="button" onClick={addType} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900">+ Type</button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Date *"><input type="date" className={inputCls} value={v.date} min={mode === "create" ? todayStr() : undefined} onChange={(e) => set("date", e.target.value)} required /></Field>
            <Field label="Start time"><input type="time" className={inputCls} value={v.startTime} onChange={(e) => set("startTime", e.target.value)} /></Field>
            <Field label="End time"><input type="time" className={inputCls} value={v.endTime} onChange={(e) => set("endTime", e.target.value)} /></Field>
          </div>
          <Field label="Venue / location *"><input className={inputCls} value={v.venue} onChange={(e) => set("venue", e.target.value)} required maxLength={200} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Community">
              <select className={inputCls} value={v.settlementCode} onChange={(e) => set("settlementCode", e.target.value)}>
                <option value="">—</option>
                {settlements.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
              </select>
            </Field>
            <Field label="Programme / project"><input className={inputCls} value={v.programme} onChange={(e) => set("programme", e.target.value)} maxLength={120} /></Field>
          </div>
          <Field label="Responsible person"><input className={inputCls} value={v.responsibleName} onChange={(e) => set("responsibleName", e.target.value)} maxLength={120} /></Field>
          <Field label="Description"><textarea className={inputCls} rows={3} value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} /></Field>
          <Field label="Instructions for the team"><textarea className={inputCls} rows={3} value={v.instructions} onChange={(e) => set("instructions", e.target.value)} maxLength={2000} /></Field>
          <CmPicker label="Assigned Community Mobilisers" value={v.assignedCmIds} onChange={(ids) => set("assignedCmIds", ids)} />
          <p className="text-xs text-zinc-400">Assigned CMs, MIS, the Programme Manager and the Director are notified, and the camp is added to Google Calendar.</p>
        </div>
        <div className="flex gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <button type="submit" disabled={busy} className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
            {busy ? "Saving…" : mode === "create" ? "Create camp" : "Save changes"}
          </button>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium dark:border-zinc-700">Cancel</button>
        </div>
      </form>
    </div>
  );
}
