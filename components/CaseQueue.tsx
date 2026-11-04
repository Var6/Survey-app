"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { MODULES, MODULE_LIST, CaseModule, CasePriority, closedStage } from "@/lib/cases/modules";
import { SEGMENTS } from "@/lib/cases/segments";
import { WORKFLOW } from "@/lib/cases/workflow";
import { Icon } from "./icons";
import { PageHeaderBroadcast } from "./PageHeader";
import Pagination from "./Pagination";
import {
  CaseItem,
  ClosureItem,
  ClosureList,
  Field,
  FollowupItem,
  FollowupList,
  PriorityPill,
  WorkflowPill,
  inputCls,
} from "./case-ui";
import { useSettlements } from "@/lib/useSettlements";

export type { CaseItem } from "./case-ui";

interface Facets {
  total: number;
  status: Record<"open" | "closed" | "overdue" | "all", number>;
  modules: Record<string, number>;
  segments: Record<string, number>;
  subcategories: Record<string, number>;
  priorities: Record<string, number>;
  settlements: Record<string, number>;
  workflow: Record<string, number>;
  followup: { none: number; submitted: number };
  cms: { id: string; name: string; count: number }[];
}
interface ListResp {
  cases: CaseItem[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

const STATUSES = [
  { key: "open", label: "Open" },
  { key: "overdue", label: "Overdue" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
] as const;

const SORTS = [
  { key: "default", label: "Priority & due date" },
  { key: "created", label: "Newest first" },
  { key: "due", label: "Due date" },
  { key: "caseId", label: "Case ID" },
] as const;

const ROLE_OF: Record<string, string> = {
  "/pm": "programme_manager",
  "/mis": "mis",
  "/director": "director",
};

const todayStr = () => new Date().toISOString().slice(0, 10);
// Params that change which rows match (page / sort do not reset facets).
const FILTER_KEYS = [
  "segment", "subcategory", "settlement", "priority", "status", "workflow",
  "closure", "followup", "cm", "reviewer", "from", "to", "q",
];

export default function CaseQueue({
  basePath,
  module,
}: {
  basePath: string;
  module: CaseModule | "all";
}) {
  const def = module === "all" ? null : MODULES[module];
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { settlements } = useSettlements(true);

  const [list, setList] = useState<ListResp | null>(null);
  const [facets, setFacets] = useState<Facets | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(sp.get("open"));
  const [qText, setQText] = useState(sp.get("q") ?? "");

  const get = (k: string) => sp.get(k) ?? "";
  const status = get("status") || "open";
  const page = Math.max(Number(get("page")) || 1, 1);

  /** Change filters in the URL (back button, refresh and shared links all keep them). */
  const setParams = useCallback(
    (patch: Record<string, string | null>, keepPage = false) => {
      const n = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") n.delete(k);
        else n.set(k, v);
      }
      if (!keepPage) n.delete("page"); // a new filter always starts at page 1
      const qs = n.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname]
  );

  // Search box: wait for a pause in typing before querying.
  useEffect(() => {
    const t = setTimeout(() => {
      if ((sp.get("q") ?? "") !== qText.trim()) setParams({ q: qText.trim() });
    }, 350);
    return () => clearTimeout(t);
  }, [qText]); // eslint-disable-line react-hooks/exhaustive-deps

  // The API query: every URL filter, plus the module this page is for.
  const apiQuery = useMemo(() => {
    const n = new URLSearchParams();
    if (module !== "all") n.set("module", module);
    for (const [k, v] of sp.entries()) if (k !== "open") n.set(k, v);
    if (!n.has("status")) n.set("status", "open");
    return n;
  }, [sp, module]);
  const filterKey = useMemo(
    () =>
      FILTER_KEYS.map((k) => `${k}=${apiQuery.get(k) ?? ""}`).join("&") + `|${module}`,
    [apiQuery, module]
  );

  const reqId = useRef(0);
  const load = useCallback(async () => {
    const id = ++reqId.current;
    setLoading(true);
    try {
      const r = await apiFetch<ListResp>(`/api/cases?${apiQuery.toString()}`);
      if (id !== reqId.current) return; // a newer request superseded this one
      setList(r);
      setErr(null);
    } catch (e) {
      if (id === reqId.current) setErr((e as Error).message);
    } finally {
      if (id === reqId.current) setLoading(false);
    }
  }, [apiQuery]);
  useEffect(() => {
    load();
  }, [load]);

  // Filter option counts cover the whole matching dataset; they only change
  // when a filter changes, not when moving between pages.
  useEffect(() => {
    const n = new URLSearchParams(apiQuery);
    ["page", "pageSize", "sort", "dir"].forEach((k) => n.delete(k));
    apiFetch<{ facets: Facets }>(`/api/cases/facets?${n.toString()}`)
      .then((r) => setFacets(r.facets))
      .catch(() => {});
  }, [filterKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const segmentsHere = SEGMENTS.filter((s) => module === "all" || s.module === module);
  const activeFilters = FILTER_KEYS.filter(
    (k) => k !== "status" && (sp.get(k) ?? "") !== ""
  ).length;

  const clearAll = () => {
    setQText("");
    router.replace(pathname, { scroll: false });
  };

  const onUpdated = (updated: CaseItem) => {
    setList((prev) =>
      prev ? { ...prev, cases: prev.cases.map((c) => (c.id === updated.id ? updated : c)) } : prev
    );
    load();
    apiFetch<{ facets: Facets }>(
      `/api/cases/facets?${(() => {
        const n = new URLSearchParams(apiQuery);
        ["page", "pageSize", "sort", "dir"].forEach((k) => n.delete(k));
        return n.toString();
      })()}`
    )
      .then((r) => setFacets(r.facets))
      .catch(() => {});
  };

  const rows = list?.cases ?? [];
  const title = def?.title ?? "All cases";
  const pendingReview =
    (facets?.workflow.closure_requested ?? 0) + (facets?.workflow.under_review ?? 0);

  return (
    <div className="space-y-4">
      <PageHeaderBroadcast title={title} subtitle="Case queue — filters, follow-up and closure review" />
      <div>
        <Link
          href={`${basePath}/cases`}
          className="text-xs font-medium text-teal-600 hover:underline dark:text-teal-400"
        >
          ← All case modules
        </Link>
        <div className="mt-1 flex items-center gap-2.5">
          {def && (
            <span className={def.color}>
              {(() => {
                const I = Icon[def.icon];
                return <I width={22} height={22} />;
              })()}
            </span>
          )}
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{title}</h1>
        </div>
      </div>

      {/* Status tabs + closure-review shortcut */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
          {STATUSES.map((s) => (
            <button
              key={s.key}
              onClick={() => setParams({ status: s.key === "open" ? null : s.key })}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                status === s.key
                  ? "bg-teal-600 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
              }`}
            >
              {s.label}
              {facets && (
                <span className="ml-1.5 text-xs tabular-nums opacity-70">
                  {facets.status[s.key].toLocaleString("en-IN")}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() =>
            setParams(
              get("closure") === "pending"
                ? { closure: null }
                : { closure: "pending", status: "open" }
            )
          }
          className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
            get("closure") === "pending"
              ? "border-amber-500 bg-amber-500 text-white"
              : "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:hover:bg-amber-950/30"
          }`}
        >
          Awaiting verification
          {facets && <span className="ml-1.5 text-xs tabular-nums">{pendingReview}</span>}
        </button>
        <input
          value={qText}
          onChange={(e) => setQText(e.target.value)}
          placeholder="Search case ID, name, household…"
          className="min-w-[14rem] flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950"
        />
      </div>

      {/* Segment chips (Out-of-school / Dropout / Pregnant / Mothers with newborn) */}
      {segmentsHere.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Chip
            label="All"
            active={!get("segment")}
            onClick={() => setParams({ segment: null })}
          />
          {segmentsHere.map((s) => (
            <Chip
              key={s.key}
              label={s.label}
              count={facets?.segments[s.key]}
              active={get("segment") === s.key}
              onClick={() => setParams({ segment: s.key, ...(module === "all" ? { module: null } : {}) })}
            />
          ))}
        </div>
      )}

      {/* Subcategory chips */}
      {def && (
        <div className="flex flex-wrap gap-1.5">
          <Chip
            label="All types"
            count={facets ? Object.values(facets.subcategories).reduce((a, b) => a + b, 0) : undefined}
            active={!get("subcategory")}
            onClick={() => setParams({ subcategory: null })}
          />
          {def.subcategories.map((sc) => (
            <Chip
              key={sc.key}
              label={sc.label}
              count={facets ? facets.subcategories[sc.key] || 0 : undefined}
              active={get("subcategory") === sc.key}
              onClick={() => setParams({ subcategory: sc.key })}
            />
          ))}
        </div>
      )}

      {/* Filters — options and counts come from the whole dataset */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
        <Select
          label="Priority"
          value={get("priority")}
          onChange={(v) => setParams({ priority: v })}
          options={(["urgent", "high", "medium", "low"] as CasePriority[]).map((p) => ({
            value: p,
            label: `${p[0].toUpperCase()}${p.slice(1)} (${facets?.priorities[p] ?? 0})`,
          }))}
        />
        <Select
          label="Settlement"
          value={get("settlement")}
          onChange={(v) => setParams({ settlement: v })}
          options={settlements.map((s) => ({
            value: s.code,
            label: `${s.label} (${facets?.settlements[s.code] ?? 0})`,
          }))}
        />
        <Select
          label="Case status"
          value={get("workflow")}
          onChange={(v) => setParams({ workflow: v, closure: null })}
          options={WORKFLOW.map((w) => ({
            value: w.key,
            label: `${w.label} (${facets?.workflow[w.key] ?? 0})`,
          }))}
        />
        <Select
          label="Follow-up"
          value={get("followup")}
          onChange={(v) => setParams({ followup: v })}
          options={[
            { value: "none", label: `Not yet followed up (${facets?.followup.none ?? 0})` },
            { value: "submitted", label: `Follow-up recorded (${facets?.followup.submitted ?? 0})` },
          ]}
        />
        <Select
          label="Community Mobiliser"
          value={get("cm")}
          onChange={(v) => setParams({ cm: v })}
          options={(facets?.cms ?? []).map((c) => ({
            value: c.id,
            label: `${c.name} (${c.count})`,
          }))}
        />
        <Select
          label="Closure"
          value={get("closure")}
          onChange={(v) => setParams({ closure: v, workflow: null })}
          options={[
            { value: "pending", label: "Pending verification" },
            { value: "approved", label: "Approved closures" },
            { value: "rejected", label: "Rejected (revision required)" },
          ]}
        />
        <Field label="Opened from">
          <input
            type="date"
            className={inputCls}
            value={get("from")}
            max={get("to") || todayStr()}
            onChange={(e) => setParams({ from: e.target.value })}
          />
        </Field>
        <Field label="Opened to">
          <input
            type="date"
            className={inputCls}
            value={get("to")}
            min={get("from") || undefined}
            max={todayStr()}
            onChange={(e) => setParams({ to: e.target.value })}
          />
        </Field>
        <Select
          label="Sort by"
          value={get("sort") === "" ? "default" : get("sort")}
          onChange={(v) => setParams({ sort: v === "default" ? null : v }, true)}
          options={SORTS.map((s) => ({ value: s.key, label: s.label }))}
          noAll
        />
        {activeFilters > 0 && (
          <div className="flex items-end">
            <button
              onClick={clearAll}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Clear {activeFilters} filter{activeFilters === 1 ? "" : "s"}
            </button>
          </div>
        )}
      </div>

      {err && <p className="text-sm text-amber-600">{err}</p>}

      {/* List */}
      {loading && !list ? (
        <div className="space-y-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
            No cases match these filters.
          </p>
          {activeFilters > 0 && (
            <button onClick={clearAll} className="mt-2 text-sm font-medium text-teal-600 underline">
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div
          className={`overflow-hidden rounded-xl border border-zinc-200 transition-opacity dark:border-zinc-800 ${
            loading ? "opacity-60" : ""
          }`}
        >
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">Case</th>
                <th className="px-3 py-2 font-medium">Subject</th>
                <th className="hidden px-3 py-2 font-medium lg:table-cell">Settlement</th>
                <th className="hidden px-3 py-2 font-medium md:table-cell">CM</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Priority</th>
                <th className="hidden px-3 py-2 font-medium sm:table-cell">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
              {rows.map((c) => {
                const overdue = !c.closed && c.dueDate && c.dueDate < todayStr();
                return (
                  <tr
                    key={c.id}
                    onClick={() => setOpenId(c.id)}
                    className="cursor-pointer bg-white transition hover:bg-teal-50/50 dark:bg-zinc-950 dark:hover:bg-zinc-900"
                  >
                    <td className="px-3 py-2.5">
                      <p className="font-mono text-xs text-zinc-400">{c.caseId}</p>
                      <p className="text-zinc-700 dark:text-zinc-200">
                        {module === "all" ? `${MODULES[c.module].short} · ` : ""}
                        {c.subcategoryLabel}
                      </p>
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-zinc-900 dark:text-zinc-50">
                        {c.subjectName || "—"}
                      </p>
                      <p className="text-xs text-zinc-400">{c.householdId}</p>
                    </td>
                    <td className="hidden px-3 py-2.5 text-zinc-500 dark:text-zinc-400 lg:table-cell">
                      {c.settlementLabel}
                    </td>
                    <td className="hidden px-3 py-2.5 text-zinc-500 dark:text-zinc-400 md:table-cell">
                      {c.assignedCmName || "—"}
                      {c.followupCount > 0 && (
                        <span className="block text-[11px] text-zinc-400">
                          {c.followupCount} follow-up{c.followupCount === 1 ? "" : "s"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <WorkflowPill status={c.workflowStatus} />
                      <p className="mt-0.5 hidden text-[11px] text-zinc-400 xl:block">{c.stageLabel}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <PriorityPill priority={c.priority} />
                    </td>
                    <td className="hidden px-3 py-2.5 text-xs sm:table-cell">
                      {c.dueDate ? (
                        <span
                          className={
                            overdue ? "font-semibold text-red-600 dark:text-red-400" : "text-zinc-500"
                          }
                        >
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

      {list && (
        <Pagination
          page={list.page}
          pages={list.pages}
          total={list.total}
          pageSize={list.pageSize}
          busy={loading}
          onPage={(p) => {
            setParams({ page: p === 1 ? null : String(p) }, true);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}

      {openId && (
        <CaseDrawer
          caseId={openId}
          basePath={basePath}
          onClose={() => {
            setOpenId(null);
            if (sp.get("open")) setParams({ open: null }, true);
          }}
          onUpdated={onUpdated}
        />
      )}
    </div>
  );
}

function Chip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
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
      {count !== undefined && (
        <span className="ml-1.5 tabular-nums opacity-60">{count.toLocaleString("en-IN")}</span>
      )}
    </button>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
  noAll,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  noAll?: boolean;
}) {
  return (
    <Field label={label}>
      <select className={inputCls} value={value} onChange={(e) => onChange(e.target.value)}>
        {!noAll && <option value="">All</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

/* ── Detail drawer: workflow, follow-ups, closure review ───────── */
function CaseDrawer({
  caseId,
  basePath,
  onClose,
  onUpdated,
}: {
  caseId: string;
  basePath: string;
  onClose: () => void;
  onUpdated: (c: CaseItem) => void;
}) {
  const myRole = ROLE_OF[basePath] ?? "";
  const [item, setItem] = useState<CaseItem | null>(null);
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [closures, setClosures] = useState<ClosureItem[]>([]);
  const [support, setSupport] = useState<{ id: string; supportDate: string; supportTypeLabels: string[]; status: string; verification: string; cmName: string | null; source: string; photoLinks: string[] }[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [cms, setCms] = useState<{ id: string; name: string }[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [priority, setPriority] = useState<CasePriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedCmId, setAssignedCmId] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);

  const hydrate = useCallback((c: CaseItem) => {
    setItem(c);
    setPriority(c.priority);
    setDueDate(c.dueDate ?? "");
    setAssignedCmId(c.assignedCmId ?? "");
    setFields(
      Object.fromEntries(MODULES[c.module].fields.map((f) => [f.key, String(c.fields[f.key] ?? "")]))
    );
  }, []);

  const loadDetail = useCallback(async () => {
    try {
      const r = await apiFetch<{ case: CaseItem; followups: FollowupItem[]; closures: ClosureItem[] }>(
        `/api/cases/${caseId}`
      );
      hydrate(r.case);
      setFollowups(r.followups);
      setClosures(r.closures);
      apiFetch<{ records: typeof support }>(`/api/support-records?case=${caseId}&pageSize=20`)
        .then((x) => setSupport(x.records))
        .catch(() => setSupport([]));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [caseId, hydrate]);

  useEffect(() => {
    loadDetail();
    apiFetch<{ user: { id: string } }>("/api/auth/me").then((r) => setMe(r.user.id)).catch(() => {});
    apiFetch<{ cms: { id: string; name: string }[] }>("/api/cms").then((r) => setCms(r.cms)).catch(() => {});
  }, [loadDetail]);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/cases/${caseId}`, { method: "PATCH", body: JSON.stringify(body) });
      setNote("");
      await loadDetail();
      const fresh = await apiFetch<{ case: CaseItem }>(`/api/cases/${caseId}`);
      onUpdated(fresh.case);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const review = async (decision: "approve" | "reject") => {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch(`/api/cases/${caseId}/closure`, {
        method: "PATCH",
        body: JSON.stringify({ decision, reason: decision === "reject" ? rejectReason : undefined }),
      });
      setRejecting(false);
      setRejectReason("");
      await loadDetail();
      const fresh = await apiFetch<{ case: CaseItem }>(`/api/cases/${caseId}`);
      onUpdated(fresh.case);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!item) {
    return (
      <div className="fixed inset-0 z-40 print:hidden">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <aside className="absolute inset-y-0 right-0 w-full max-w-lg bg-white p-6 shadow-xl dark:bg-zinc-950">
          <p className="text-sm text-zinc-400">{err ?? "Loading…"}</p>
          <button onClick={onClose} className="mt-4 text-sm text-teal-600 underline">
            Close
          </button>
        </aside>
      </div>
    );
  }

  const def = MODULES[item.module];
  const wf = def.workflow;
  const curIdx = wf.findIndex((w) => w.key === item.stage);
  const nextStage = curIdx >= 0 && curIdx < wf.length - 1 ? wf[curIdx + 1] : null;
  const reviewable = item.workflowStatus === "closure_requested" || item.workflowStatus === "under_review";
  const active = closures.find((c) => c.status === "pending" || c.status === "under_review");
  const myDecision = active?.decisions.find((d) => d.userId === me);
  const pendingRoles = active
    ? active.policy.requiredRoles.filter(
        (r) => !active.decisions.some((d) => d.decision === "approve" && d.role === r)
      )
    : [];

  return (
    <div className="fixed inset-0 z-40 print:hidden">
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
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <WorkflowPill status={item.workflowStatus} />
              <PriorityPill priority={item.priority} />
              {item.segmentLabel && (
                <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                  {item.segmentLabel}
                </span>
              )}
            </div>
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
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{err}</p>}

          {/* Closure review */}
          {reviewable && active && (
            <section className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-200">
                Closure requested by {active.requestedByName}
              </h3>
              {active.note && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-amber-900/90 dark:text-amber-100">
                  {active.note}
                </p>
              )}
              <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">Rule: {active.policy.text}</p>
              {pendingRoles.length > 0 && active.policy.mode !== "any" && (
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                  Still needed: {pendingRoles.map((r) => (r === "programme_manager" ? "Programme Manager" : r === "mis" ? "MIS" : "Director")).join(", ")}
                </p>
              )}
              {myDecision ? (
                <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                  You {myDecision.decision === "approve" ? "approved" : "rejected"} this request.
                </p>
              ) : rejecting ? (
                <div className="mt-3 space-y-2">
                  <Field label="Reason for rejecting (required — the CM will see this)">
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      className={inputCls}
                      autoFocus
                    />
                  </Field>
                  <div className="flex gap-2">
                    <button
                      onClick={() => review("reject")}
                      disabled={busy || rejectReason.trim().length < 3}
                      className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {busy ? "Saving…" : "Send back to CM"}
                    </button>
                    <button
                      onClick={() => setRejecting(false)}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-700"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => review("approve")}
                    disabled={busy}
                    className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                  >
                    Approve closure
                  </button>
                  <button
                    onClick={() => setRejecting(true)}
                    disabled={busy}
                    className="rounded-lg border border-red-300 px-3.5 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:text-red-400"
                  >
                    Reject…
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Follow-ups by the CM */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              CM follow-ups ({followups.length}) · {item.assignedCmName ?? "unassigned"}
            </h3>
            <FollowupList followups={followups} />
          </section>

          {support.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Support & follow-up forms ({support.length})
              </h3>
              <ul className="space-y-1.5">
                {support.map((s) => (
                  <li key={s.id} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                    <a href={`${basePath}/support?open=${s.id}`} className="font-medium text-teal-700 underline dark:text-teal-400">
                      {s.supportTypeLabels.join(", ")}
                    </a>
                    <span className="text-zinc-400"> · {formatDate(s.supportDate)} · {s.status === "complete" ? "Complete" : "Follow-up required"}{s.verification !== "not_needed" ? ` · ${s.verification}` : ""}{s.source === "import" ? " · Google Sheet" : ""}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {closures.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Closure requests
              </h3>
              <ClosureList closures={closures} />
            </section>
          )}

          {/* Staff workflow */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Service workflow
            </h3>
            <ol className="space-y-1.5">
              {wf.map((stage, i) => {
                const done = !item.closed && i < curIdx;
                const current = i === curIdx && !item.closed;
                const doneClosed = item.closed && i === wf.length - 1;
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
                  onClick={() => {
                    if (window.confirm("Close this case now, without the CM's closure request and the normal review?"))
                      patch({ stage: closedStage(item.module), note: note || undefined });
                  }}
                  disabled={busy}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
                >
                  Close directly
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
              <Field label="Responsible CM">
                <select
                  value={assignedCmId}
                  onChange={(e) => setAssignedCmId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">—</option>
                  {cms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
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
              onClick={() =>
                patch({
                  priority,
                  dueDate,
                  fields,
                  note: note || undefined,
                  ...(assignedCmId && assignedCmId !== item.assignedCmId ? { assignedCmId } : {}),
                })
              }
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
          {myRole === "" && null}
        </div>
      </aside>
    </div>
  );
}

export { MODULE_LIST };
