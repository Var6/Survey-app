"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import {
  MODULES,
  CaseModule,
  CasePriority,
  closedStage,
} from "@/lib/cases/modules";
import { Icon } from "./icons";
import { PageHeaderBroadcast } from "./PageHeader";

interface HistoryItem {
  at: string;
  stage: string | null;
  stageLabel: string | null;
  note: string | null;
  by: string | null;
}
export interface CaseItem {
  id: string;
  caseId: string;
  module: CaseModule;
  subcategory: string;
  subcategoryLabel: string;
  title: string;
  subjectName: string | null;
  priority: CasePriority;
  stage: string;
  stageLabel: string;
  closed: boolean;
  householdId: string;
  settlementLabel: string;
  assignee: string | null;
  dueDate: string | null;
  meta: Record<string, unknown>;
  fields: Record<string, unknown>;
  history: HistoryItem[];
  createdAt: string;
}

const STATUSES = [
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

const PRIORITY_STYLE: Record<CasePriority, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  medium: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400",
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export default function CaseQueue({
  basePath,
  module,
}: {
  basePath: string;
  module: CaseModule;
}) {
  const def = MODULES[module];
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [status, setStatus] = useState("open");
  const [sub, setSub] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<CaseItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ cases: CaseItem[] }>(
        `/api/cases?module=${module}&status=${status}&limit=500`
      );
      setCases(r.cases);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [module, status]);
  useEffect(() => {
    load();
  }, [load]);

  const subCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cases) m[c.subcategory] = (m[c.subcategory] || 0) + 1;
    return m;
  }, [cases]);

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return cases.filter((c) => {
      if (sub !== "all" && c.subcategory !== sub) return false;
      if (needle) {
        const hay = `${c.caseId} ${c.subjectName ?? ""} ${c.householdId} ${c.title}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [cases, sub, q]);

  const onUpdated = (updated: CaseItem) => {
    setCases((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    setSelected(updated);
    // If it no longer matches the current status filter, refresh the list.
    if (
      (status === "open" && updated.closed) ||
      (status === "closed" && !updated.closed)
    ) {
      load();
    }
  };

  return (
    <div className="space-y-5">
      <PageHeaderBroadcast
        title={def.title}
        subtitle="Case queue — subcategories, workflow and follow-up"
      />
      <div>
        <Link
          href={`${basePath}/cases`}
          className="text-xs font-medium text-teal-600 hover:underline dark:text-teal-400"
        >
          ← All case modules
        </Link>
        <div className="mt-1 flex items-center gap-2.5">
          <span className={`${def.color}`}>
            {(() => {
              const I = Icon[def.icon];
              return <I width={22} height={22} />;
            })()}
          </span>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{def.title}</h1>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => setStatus(s.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                status === s.key
                  ? "bg-teal-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search case, name, household…"
          className="flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>

      {/* Subcategory tabs */}
      <div className="flex flex-wrap gap-1.5">
        <SubTab label="All" count={cases.length} active={sub === "all"} onClick={() => setSub("all")} />
        {def.subcategories.map((sc) => (
          <SubTab
            key={sc.key}
            label={sc.label}
            count={subCounts[sc.key] || 0}
            active={sub === sc.key}
            onClick={() => setSub(sc.key)}
          />
        ))}
      </div>

      {/* List */}
      {err && <p className="text-sm text-amber-600">{err}</p>}
      {loading ? (
        <p className="text-sm text-zinc-400">Loading cases…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 py-10 text-center text-sm text-zinc-400 dark:border-zinc-700">
          No cases in this view.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">Case</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Settlement</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">Stage</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {visible.map((c) => {
                const overdue = !c.closed && c.dueDate && c.dueDate < todayStr();
                return (
                  <tr
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className="cursor-pointer bg-white transition hover:bg-teal-50/50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-mono text-xs text-zinc-400">{c.caseId}</p>
                      <p className="text-zinc-700 dark:text-zinc-200">{c.subcategoryLabel}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {c.subjectName || "—"}
                      </p>
                      <p className="text-xs text-zinc-400">{c.householdId}</p>
                    </td>
                    <td className="hidden px-3 py-2.5 text-zinc-500 dark:text-zinc-400 sm:table-cell">
                      {c.settlementLabel}
                    </td>
                    <td className="hidden px-3 py-2.5 md:table-cell">
                      {c.closed ? (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                          Closed
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500 dark:text-zinc-400">{c.stageLabel}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${PRIORITY_STYLE[c.priority]}`}
                      >
                        {c.priority}
                      </span>
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs sm:table-cell">
                      {c.dueDate ? (
                        <span className={overdue ? "font-semibold text-red-600 dark:text-red-400" : "text-zinc-500"}>
                          {formatDate(c.dueDate)}
                        </span>
                      ) : (
                        <span className="text-zinc-300 dark:text-zinc-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <CaseDrawer
          item={selected}
          onClose={() => setSelected(null)}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}

function SubTab({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
      }`}
    >
      {label}
      <span className="ml-1.5 tabular-nums opacity-60">{count}</span>
    </button>
  );
}

/* ── Detail drawer with workflow ───────────────────────────────── */
function CaseDrawer({
  item,
  onClose,
  onUpdated,
}: {
  item: CaseItem;
  onClose: () => void;
  onUpdated: (c: CaseItem) => void;
}) {
  const def = MODULES[item.module];
  const wf = def.workflow;
  const curIdx = wf.findIndex((w) => w.key === item.stage);
  const nextStage = curIdx >= 0 && curIdx < wf.length - 1 ? wf[curIdx + 1] : null;

  const [assignee, setAssignee] = useState(item.assignee ?? "");
  const [priority, setPriority] = useState<CasePriority>(item.priority);
  const [dueDate, setDueDate] = useState(item.dueDate ?? "");
  const [fields, setFields] = useState<Record<string, string>>(
    Object.fromEntries(def.fields.map((f) => [f.key, String(item.fields[f.key] ?? "")]))
  );
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ case: CaseItem }>(`/api/cases/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onUpdated(r.case);
      setNote("");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = () =>
    patch({
      assignee,
      priority,
      dueDate,
      fields,
      note: note || undefined,
    });

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-lg flex-col bg-white shadow-xl dark:bg-zinc-950">
        <div className="flex items-start justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <p className="font-mono text-xs text-zinc-400">{item.caseId}</p>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {item.subjectName || item.title}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {item.subcategoryLabel} · {item.householdId} · {item.settlementLabel}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Close"
          >
            <Icon.close />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
          {err && <p className="text-sm text-red-600">{err}</p>}

          {/* Workflow */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Workflow
            </h3>
            <ol className="space-y-1.5">
              {wf.map((stage, i) => {
                const done = !item.closed && i < curIdx;
                const current = i === curIdx && !item.closed;
                const isClosedStage = i === wf.length - 1;
                const doneClosed = item.closed && isClosedStage;
                return (
                  <li key={stage.key} className="flex items-center gap-2.5 text-sm">
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                        current
                          ? "bg-teal-600 text-white"
                          : done || doneClosed
                          ? "bg-emerald-500 text-white"
                          : "bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                    >
                      {done || doneClosed ? "✓" : i + 1}
                    </span>
                    <span
                      className={
                        current
                          ? "font-semibold text-zinc-900 dark:text-zinc-50"
                          : "text-zinc-500 dark:text-zinc-400"
                      }
                    >
                      {stage.label}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              {nextStage && !item.closed && (
                <button
                  onClick={() => patch({ stage: nextStage.key, note: note || undefined })}
                  disabled={busy}
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  Advance → {nextStage.label}
                </button>
              )}
              {!item.closed && (
                <button
                  onClick={() => patch({ stage: closedStage(item.module), note: note || undefined })}
                  disabled={busy}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Close case
                </button>
              )}
              {item.closed && (
                <button
                  onClick={() => patch({ reopen: true, note: note || undefined })}
                  disabled={busy}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Reopen
                </button>
              )}
            </div>
          </section>

          {/* Case management fields */}
          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Case management
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Assigned to">
                <input
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className={inputCls}
                  placeholder="Staff name"
                />
              </Field>
              <Field label="Priority">
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as CasePriority)}
                  className={inputCls}
                >
                  {(["urgent", "high", "medium", "low"] as CasePriority[]).map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Due / follow-up date">
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {def.fields.map((f) =>
                f.type === "textarea" ? (
                  <div key={f.key} className="col-span-2">
                    <Field label={f.label}>
                      <textarea
                        value={fields[f.key] ?? ""}
                        onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                        rows={2}
                        className={inputCls}
                      />
                    </Field>
                  </div>
                ) : (
                  <Field key={f.key} label={f.label}>
                    {f.type === "yesno" ? (
                      <select
                        value={fields[f.key] ?? ""}
                        onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                        className={inputCls}
                      >
                        <option value="">—</option>
                        <option value="yes">Yes</option>
                        <option value="no">No</option>
                      </select>
                    ) : (
                      <input
                        type={f.type === "date" ? "date" : "text"}
                        value={fields[f.key] ?? ""}
                        onChange={(e) => setFields({ ...fields, [f.key]: e.target.value })}
                        className={inputCls}
                      />
                    )}
                  </Field>
                )
              )}
            </div>
            <Field label="Add a note (optional)">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className={inputCls}
                placeholder="What happened / what's next"
              />
            </Field>
            <button
              onClick={saveDetails}
              disabled={busy}
              className="rounded-lg bg-zinc-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {busy ? "Saving…" : "Save changes"}
            </button>
          </section>

          {/* Survey context */}
          {item.meta && Object.keys(item.meta).length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                From the survey
              </h3>
              <dl className="space-y-1 rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-900">
                {Object.entries(item.meta).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-zinc-400">{k}</dt>
                    <dd className="text-right text-zinc-600 dark:text-zinc-300">
                      {Array.isArray(v) ? v.join(", ") : String(v ?? "—")}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {/* History */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Activity
            </h3>
            <ul className="space-y-2">
              {[...item.history].reverse().map((h, i) => (
                <li key={i} className="text-xs">
                  <span className="text-zinc-700 dark:text-zinc-200">{h.note}</span>
                  <span className="text-zinc-400">
                    {" "}
                    · {formatDate(h.at)}
                    {h.by ? ` · ${h.by}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}
