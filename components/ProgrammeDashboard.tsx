"use client";

import Link from "next/link";
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
  early_childhood: { donut: "text-sky-500", bar: "bg-sky-500" },
  youth: { donut: "text-indigo-500", bar: "bg-indigo-500" },
  women: { donut: "text-pink-500", bar: "bg-pink-500" },
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

/** Where a case tile or legend row opens: the module page, filters preserved. */
function caseHref(basePath: string | undefined, module: string | undefined, query: string | undefined) {
  // Finance has no case pages: its tiles stay plain numbers.
  if (!basePath) return undefined;
  return `${basePath}/cases/${module || "all"}${query ? `?${query}` : ""}`;
}

export default function ProgrammeDashboard({ basePath }: { basePath?: string }) {
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

  const tile = (key: string) => m.tiles.find((t) => t.key === key)!;
  // A plain function (not a component) so it can read `m` and `basePath`.
  const caseTile = (k: string, hint?: string) => {
    const t = tile(k);
    return (
      <StatTile
        key={k}
        label={t.label}
        value={t.value}
        hint={hint ?? t.hint}
        tone={t.value > 0 && t.tone ? t.tone : "normal"}
        href={caseHref(basePath, t.module, t.query)}
      />
    );
  };

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
    href: caseHref(basePath, c.module, "status=open"),
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
          {caseTile("open", `${m.householdsFollowup.toLocaleString("en-IN")} households`)}
          {caseTile("urgent")}
          {caseTile("overdue")}
          {caseTile("review")}
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Open cases by thematic area">
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

      {/* Children and mothers — each group separate, each opens its own report */}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Children and mothers
        </h3>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {caseTile("out_of_school", "Never enrolled or not attending")}
          {caseTile("dropout", "Enrolled earlier, then left")}
          {caseTile("pregnant", "Currently pregnant")}
          {caseTile("newborn_mother", "Delivered in the last 6 months")}
        </div>
        {m.maternalUnclassified > 0 && basePath && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            {m.maternalUnclassified.toLocaleString("en-IN")} open maternal case
            {m.maternalUnclassified === 1 ? " is" : "s are"} not yet sorted into pregnant / newborn.{" "}
            <Link
              href={caseHref(basePath, "maternal", "status=open&segment=maternal_unspecified")!}
              className="font-medium underline"
            >
              View them
            </Link>
            {" · "}
            <Link href={`${basePath}/cases`} className="font-medium underline">
              Use “Generate from surveys” to classify them
            </Link>
          </p>
        )}
      </div>

      {/* Remaining metric tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {caseTile("pending_docs")}
        <StatTile
          label="Persons with disabilities"
          value={m.pwd.total}
          hint={`${m.pwd.children} children · ${m.pwd.adults} adults`}
        />
        <StatTile
          label="Escalated to Director"
          value={m.directorIntervention}
          tone={m.directorIntervention > 0 ? "alert" : "normal"}
          hint="From survey flags"
        />
      </div>
    </div>
  );
}
