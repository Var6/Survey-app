"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { Icon, IconName } from "./icons";
import { StatTile } from "./charts";
import { PageHeaderBroadcast } from "./PageHeader";

interface ModuleSummary {
  module: string;
  title: string;
  short: string;
  icon: string;
  color: string;
  total: number;
  open: number;
  urgent: number;
  overdue: number;
}
interface SummaryResp {
  summary: ModuleSummary[];
  totals: { open: number; urgent: number; overdue: number };
  at: string;
}

export default function CasesOverview({ basePath }: { basePath: string }) {
  const [data, setData] = useState<SummaryResp | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<SummaryResp>("/api/cases/summary");
      setData(r);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  const backfill = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiFetch<{ created: number; updated: number; surveys: number }>(
        "/api/cases/backfill",
        { method: "POST" }
      );
      setMsg(`Scanned ${r.surveys} surveys — ${r.created} new cases, ${r.updated} refreshed.`);
      await load();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeaderBroadcast
        title="Case modules"
        subtitle="Service cases auto-created from survey triggers across the seven thematic areas"
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">Case modules</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Service cases auto-created from survey triggers across the seven thematic areas.
          </p>
        </div>
        <button
          onClick={backfill}
          disabled={busy}
          className="rounded-lg bg-teal-600 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
        >
          {busy ? "Generating…" : "Generate from surveys"}
        </button>
      </div>

      {msg && (
        <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800 dark:bg-teal-950/30 dark:text-teal-300">
          {msg}
        </p>
      )}
      {err && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          {err}
        </p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatTile label="Open cases" value={data.totals.open} />
            <StatTile
              label="Urgent (open)"
              value={data.totals.urgent}
              tone={data.totals.urgent > 0 ? "alert" : "normal"}
            />
            <StatTile
              label="Overdue"
              value={data.totals.overdue}
              tone={data.totals.overdue > 0 ? "warn" : "normal"}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.summary.map((m) => {
              const IconCmp = Icon[m.icon as IconName] || Icon.grid;
              return (
                <Link
                  key={m.module}
                  href={`${basePath}/cases/${m.module}`}
                  className="group rounded-2xl border border-zinc-200 bg-white p-4 transition hover:border-teal-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-teal-600"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-900 ${m.color}`}
                    >
                      <IconCmp />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                        {m.title}
                      </p>
                      <p className="text-xs text-zinc-400">{m.total} total</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                        {m.open}
                      </p>
                      <p className="text-[11px] text-zinc-400">open cases</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {m.urgent > 0 && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:bg-red-950/50 dark:text-red-400">
                          {m.urgent} urgent
                        </span>
                      )}
                      {m.overdue > 0 && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                          {m.overdue} overdue
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
