"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import type { DashboardMetrics } from "@/lib/dashboard/metrics";

const REFRESH_MS = 45000;

interface CardDef {
  label: string;
  value: number | string;
  sub?: string;
  tone: "normal" | "alert";
  bar?: number;
}

function cards(m: DashboardMetrics): CardDef[] {
  return [
    {
      label: "Households Surveyed",
      value: m.householdsSurveyed.count,
      sub: `of ${m.householdsSurveyed.target.toLocaleString("en-IN")} · ${m.householdsSurveyed.percent}%`,
      tone: "normal",
      bar: Math.min(m.householdsSurveyed.percent, 100),
    },
    { label: "Households Requiring Follow-up", value: m.householdsFollowup, tone: "normal" },
    { label: "Open Action Cases", value: m.openActionCases, tone: "normal" },
    { label: "Overdue Cases", value: m.overdueCases, tone: m.overdueCases > 0 ? "alert" : "normal" },
    { label: "High-Priority / Urgent", value: m.highPriority, tone: m.highPriority > 0 ? "alert" : "normal" },
    { label: "Out-of-School Children", value: m.outOfSchool, tone: "normal" },
    {
      label: "Persons with Disabilities",
      value: m.pwd.total,
      sub: `${m.pwd.children} children · ${m.pwd.adults} adults`,
      tone: "normal",
    },
    { label: "Pregnant / New Mothers (follow-up)", value: m.pregnantFollowup, tone: "normal" },
    { label: "Pending Social-Security & Docs", value: m.pendingDocs, tone: "normal" },
    {
      label: "Cases Requiring Director Intervention",
      value: m.directorIntervention,
      tone: m.directorIntervention > 0 ? "alert" : "normal",
    },
  ];
}

export default function ProgrammeDashboard() {
  const [m, setM] = useState<DashboardMetrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [updated, setUpdated] = useState("");

  const load = useCallback(async () => {
    try {
      const { metrics } = await apiFetch<{ metrics: DashboardMetrics }>(
        "/api/dashboard/metrics"
      );
      setM(metrics);
      setErr(null);
      setUpdated(new Date().toLocaleTimeString("en-IN"));
    } catch (e) {
      setErr((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (err) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
        Could not load dashboard metrics: {err}
      </p>
    );
  }
  if (!m) return <p className="text-sm text-zinc-500">Loading dashboard…</p>;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Programme dashboard
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
          live · {updated}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {cards(m).map((c) => {
          const alert = c.tone === "alert";
          return (
            <div
              key={c.label}
              className={`rounded-xl border p-3 ${
                alert
                  ? "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
                  : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              }`}
            >
              <p
                className={`text-2xl font-bold tabular-nums ${
                  alert ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-zinc-50"
                }`}
              >
                {typeof c.value === "number" ? c.value.toLocaleString("en-IN") : c.value}
              </p>
              <p className="mt-0.5 text-xs leading-tight text-zinc-500 dark:text-zinc-400">
                {c.label}
              </p>
              {c.sub && <p className="text-[11px] text-zinc-400">{c.sub}</p>}
              {c.bar !== undefined && (
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                  <div className="h-full bg-teal-600" style={{ width: `${c.bar}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
