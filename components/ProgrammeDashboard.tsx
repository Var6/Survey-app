"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import type { DashboardMetrics } from "@/lib/dashboard/metrics";
import { ProgressRing, Donut, HBars, StatTile, Legend } from "./charts";

const REFRESH_MS = 45000;

const CAT_COLORS: Record<string, { donut: string; bar: string }> = {
  entitlements: { donut: "text-teal-500", bar: "bg-teal-500" },
  health: { donut: "text-rose-500", bar: "bg-rose-500" },
  maternal: { donut: "text-violet-500", bar: "bg-violet-500" },
  education: { donut: "text-amber-500", bar: "bg-amber-500" },
  disability: { donut: "text-sky-500", bar: "bg-sky-500" },
  pension: { donut: "text-emerald-500", bar: "bg-emerald-500" },
};

function Card({
  title,
  action,
  children,
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
      {title && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export default function ProgrammeDashboard() {
  const [m, setM] = useState<DashboardMetrics | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [updated, setUpdated] = useState("");

  const load = useCallback(async () => {
    try {
      const { metrics } = await apiFetch<{ metrics: DashboardMetrics }>("/api/dashboard/metrics");
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
  if (!m) {
    return (
      <div className="grid animate-pulse grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl bg-zinc-100 dark:bg-zinc-900" />
        ))}
      </div>
    );
  }

  const donutData = m.needsByCategory
    .filter((c) => c.value > 0)
    .map((c) => ({
      label: c.label,
      value: c.value,
      className: CAT_COLORS[c.key]?.donut || "text-zinc-400",
    }));
  const legendData = m.needsByCategory.map((c) => ({
    label: c.label,
    value: c.value,
    className: CAT_COLORS[c.key]?.bar || "bg-zinc-400",
  }));
  const settlementBars = m.bySettlement.slice(0, 12).map((s) => ({
    label: s.label,
    value: s.value,
    className: "bg-teal-500",
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100">Programme dashboard</h2>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-teal-500" />
          live · updated {updated}
        </span>
      </div>

      {/* Hero: survey progress + headline tiles */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <div className="flex items-center gap-5">
            <ProgressRing value={m.householdsSurveyed.count} max={m.householdsSurveyed.target}>
              <span className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {m.householdsSurveyed.percent}%
              </span>
              <span className="text-[11px] text-zinc-400">of target</span>
            </ProgressRing>
            <div>
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Households surveyed</p>
              <p className="mt-0.5 text-3xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
                {m.householdsSurveyed.count.toLocaleString("en-IN")}
              </p>
              <p className="text-xs text-zinc-400">
                Target {m.householdsSurveyed.target.toLocaleString("en-IN")}
              </p>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2">
          <StatTile label="Households requiring follow-up" value={m.householdsFollowup} icon={<span className="text-lg">↻</span>} />
          <StatTile label="Open action cases" value={m.openActionCases} />
          <StatTile
            label="High-priority / urgent"
            value={m.highPriority}
            tone={m.highPriority > 0 ? "alert" : "normal"}
          />
          <StatTile
            label="Cases needing Director intervention"
            value={m.directorIntervention}
            tone={m.directorIntervention > 0 ? "alert" : "normal"}
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Case load by thematic area">
          {donutData.length > 0 ? (
            <div className="flex items-center gap-6">
              <Donut data={donutData} />
              <div className="flex-1">
                <Legend items={legendData} />
              </div>
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-zinc-400">No active cases yet.</p>
          )}
        </Card>
        <Card title="Surveys by settlement">
          {settlementBars.length > 0 ? (
            <HBars data={settlementBars} />
          ) : (
            <p className="py-8 text-center text-sm text-zinc-400">No surveys recorded yet.</p>
          )}
        </Card>
      </div>

      {/* Remaining metric tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile
          label="Overdue cases"
          value={m.overdueCases}
          tone={m.overdueCases > 0 ? "alert" : "normal"}
        />
        <StatTile label="Out-of-school children" value={m.outOfSchool} tone={m.outOfSchool > 0 ? "warn" : "normal"} />
        <StatTile
          label="Persons with disabilities"
          value={m.pwd.total}
          hint={`${m.pwd.children} children · ${m.pwd.adults} adults`}
        />
        <StatTile label="Pregnant / new mothers" value={m.pregnantFollowup} tone={m.pregnantFollowup > 0 ? "warn" : "normal"} />
        <StatTile label="Pending social security & docs" value={m.pendingDocs} />
        <StatTile label="Requiring follow-up" value={m.householdsFollowup} />
      </div>
    </div>
  );
}
