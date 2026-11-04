"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { apiFetch, formatDate } from "@/lib/client";
import { Card, Empty, Badge, inputClass, btnGhost } from "@/components/ui";
import { useSettlements } from "@/lib/useSettlements";
import Pagination from "@/components/Pagination";

const PAGE_SIZE = 100;
const todayIst = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

interface Summary {
  complete: number;
  partial: number;
  refused: number;
  synced: number;
  notSynced: number;
}

/** Path of the survey form for the area the list is shown in. */
function formPath(pathname: string): string {
  if (pathname.startsWith("/director")) return "/director/surveys/new";
  if (pathname.startsWith("/pm")) return "/pm/survey/new";
  if (pathname.startsWith("/mis")) return "/mis/survey/new";
  return "/cm/survey/new";
}

interface SurveyRow {
  id: string;
  householdId: string;
  settlementLabel: string;
  mobiliserName: string | null;
  headName: string | null;
  totalMembers: number | null;
  status: string;
  sync: { status: string; frappeId: string | null };
  createdAt: string;
}
interface CM {
  id: string;
  name: string;
}

export default function SurveysClient({
  scope,
}: {
  scope: "director" | "cm" | "mis";
}) {
  // "mis" scope covers the Programme Manager screens too — every office role
  // gets the same filters and export the Director has; only CMs are narrowed
  // to their own surveys.
  const isDirector = scope === "director" || scope === "mis";
  const canExport = isDirector;
  const pathname = usePathname();
  const { settlements } = useSettlements(true);
  const [rows, setRows] = useState<SurveyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [mobilisers, setMobilisers] = useState<CM[]>([]);

  const [mobiliserId, setMobiliserId] = useState("");
  const [settlement, setSettlement] = useState("");
  const [sync, setSync] = useState("");
  const [status, setStatus] = useState("");
  // Dates are typed first, then applied with the button; the applied pair is
  // what the list and every export use.
  const [fromDraft, setFromDraft] = useState("");
  const [toDraft, setToDraft] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const rangeInvalid = !!fromDraft && !!toDraft && fromDraft > toDraft;
  const dirty = fromDraft !== from || toDraft !== to;

  /** The filters only — no paging. The list adds a page; exports use it as is. */
  const query = useCallback(() => {
    const p = new URLSearchParams();
    if (isDirector && mobiliserId) p.set("mobiliserId", mobiliserId);
    if (settlement) p.set("settlement", settlement);
    if (sync) p.set("sync", sync);
    if (status) p.set("status", status);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return p.toString();
  }, [isDirector, mobiliserId, settlement, sync, status, from, to]);

  // Any filter change starts again from page 1.
  useEffect(() => {
    setPage(1);
  }, [mobiliserId, settlement, sync, status, from, to]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ surveys: SurveyRow[]; total: number; summary: Summary }>(
        `/api/surveys?${query()}&limit=${PAGE_SIZE}&page=${page}`
      );
      setRows(r.surveys);
      setTotal(r.total);
      setSummary(r.summary);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isDirector) {
      apiFetch<{ users: CM[] }>("/api/users")
        .then(({ users }) => setMobilisers(users))
        .catch(() => {});
    }
  }, [isDirector]);

  async function removeSurvey(id: string, householdId: string) {
    if (
      !window.confirm(
        `Delete survey ${householdId} permanently? Cases derived from it are removed too.`
      )
    )
      return;
    try {
      await apiFetch(`/api/surveys/${id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {isDirector && (
            <select className={inputClass} value={mobiliserId} onChange={(e) => setMobiliserId(e.target.value)}>
              <option value="">All mobilisers</option>
              {mobilisers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
          <select className={inputClass} value={settlement} onChange={(e) => setSettlement(e.target.value)}>
            <option value="">All settlements</option>
            {settlements.map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </select>
          <select className={inputClass} value={sync} onChange={(e) => setSync(e.target.value)}>
            <option value="">Any sync status</option>
            <option value="synced">Synced</option>
            <option value="unsynced">Not synced</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
          <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="complete">Complete</option>
            <option value="partial">Incomplete (partial)</option>
            <option value="refused_midway">Refused midway</option>
          </select>
        </div>

        {/* Date range: type the dates, then Apply */}
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">From date</span>
            <input
              type="date"
              className={inputClass}
              value={fromDraft}
              max={toDraft || todayIst()}
              onChange={(e) => setFromDraft(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-500">To date</span>
            <input
              type="date"
              className={inputClass}
              value={toDraft}
              min={fromDraft || undefined}
              max={todayIst()}
              onChange={(e) => setToDraft(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:opacity-50"
            disabled={rangeInvalid || !dirty}
            onClick={() => {
              setFrom(fromDraft);
              setTo(toDraft);
            }}
          >
            Apply filter
          </button>
          {(from || to || fromDraft || toDraft) && (
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                setFromDraft("");
                setToDraft("");
                setFrom("");
                setTo("");
              }}
            >
              Clear dates
            </button>
          )}
          {rangeInvalid && (
            <span className="text-xs text-red-600">“From” must be on or before “To”.</span>
          )}
        </div>

        {canExport && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500">
              Exports include every filter above ({total.toLocaleString("en-IN")} survey{total === 1 ? "" : "s"}):
            </span>
            <a href={`/api/surveys/export?${query()}`} className={btnGhost}>
              ⬇ Excel
            </a>
            <a href={`/api/surveys/export?${query()}&format=csv`} className={btnGhost}>
              ⬇ CSV
            </a>
            <a
              href={`${pathname.replace(/\/surveys.*$/, "")}/surveys-print?${query()}`}
              className={btnGhost}
            >
              ⬇ PDF
            </a>
          </div>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-zinc-500">
        <span className="font-medium text-zinc-700 dark:text-zinc-200">
          {loading && rows.length === 0 ? "Loading…" : `${total.toLocaleString("en-IN")} survey${total === 1 ? "" : "s"}`}
          {(from || to) && ` · ${from || "start"} → ${to || "today"}`}
        </span>
        {summary && total > 0 && (
          <>
            <span>Complete {summary.complete.toLocaleString("en-IN")}</span>
            <span>Incomplete {(summary.partial + summary.refused).toLocaleString("en-IN")}</span>
            <span>Synced {summary.synced.toLocaleString("en-IN")}</span>
            <span>Not synced {summary.notSynced.toLocaleString("en-IN")}</span>
          </>
        )}
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && rows.length === 0 ? (
        <Empty>No surveys match these filters yet.</Empty>
      ) : (
        <div className={`space-y-2 ${loading ? "opacity-60" : ""}`}>
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <Link href={`${pathname}/${r.id}`} className="min-w-0 flex-1">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {r.headName || "—"}{" "}
                    <span className="text-xs font-normal text-zinc-400">
                      {r.householdId}
                    </span>
                  </p>
                  <p className="text-sm text-zinc-500">
                    {r.settlementLabel}
                    {r.totalMembers != null ? ` · ${r.totalMembers} members` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {isDirector && r.mobiliserName ? `${r.mobiliserName} · ` : ""}
                    {formatDate(r.createdAt)} · <span className="text-teal-600 dark:text-teal-400">देखें / View</span>
                  </p>
                </Link>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge value={r.status} />
                  <Badge value={r.sync.status} />
                  {r.status !== "complete" && (
                    <Link
                      href={`${formPath(pathname)}?resume=${r.id}`}
                      className="rounded px-1.5 py-0.5 text-xs font-medium text-teal-600 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/30"
                    >
                      {scope === "cm" ? "जारी रखें" : "Resume"}
                    </Link>
                  )}
                  {scope === "director" && (
                    <button
                      className="rounded px-1.5 py-0.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={() => removeSurvey(r.id, r.householdId)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pages={Math.max(Math.ceil(total / PAGE_SIZE), 1)}
        total={total}
        pageSize={PAGE_SIZE}
        busy={loading}
        onPage={(p) => {
          setPage(p);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
      />
    </div>
  );
}
