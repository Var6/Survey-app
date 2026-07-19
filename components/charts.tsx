"use client";

/**
 * Dependency-free SVG chart kit for the laptop-first dashboards.
 * Everything is theme-aware via Tailwind classes (stroke/fill utilities)
 * and scales with its container.
 */

import { ReactNode } from "react";

/* ── Progress ring / donut ─────────────────────────────────────── */
export function ProgressRing({
  value,
  max,
  size = 132,
  stroke = 12,
  color = "text-teal-600",
  track = "text-zinc-200 dark:text-zinc-800",
  children,
}: {
  value: number;
  max: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const dash = c * pct;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className={track}
          stroke="currentColor"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          className={color}
          stroke="currentColor"
          strokeDasharray={`${dash} ${c - dash}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children}
      </div>
    </div>
  );
}

/* ── Multi-segment donut ───────────────────────────────────────── */
export function Donut({
  data,
  size = 132,
  stroke = 16,
}: {
  data: { label: string; value: number; className: string }[];
  size?: number;
  stroke?: number;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let offset = 0;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        strokeWidth={stroke}
        className="text-zinc-200 dark:text-zinc-800"
        stroke="currentColor"
      />
      {data.map((d, i) => {
        const len = (d.value / total) * c;
        const seg = (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className={d.className}
            stroke="currentColor"
            strokeDasharray={`${len} ${c - len}`}
            strokeDashoffset={-offset}
          />
        );
        offset += len;
        return seg;
      })}
    </svg>
  );
}

/* ── Horizontal bar chart ──────────────────────────────────────── */
export function HBars({
  data,
  valueSuffix = "",
}: {
  data: { label: string; value: number; className?: string }[];
  valueSuffix?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <div className="w-32 shrink-0 truncate text-xs text-zinc-500 dark:text-zinc-400" title={d.label}>
            {d.label}
          </div>
          <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
            <div
              className={`h-full rounded-md ${d.className || "bg-teal-500"}`}
              style={{ width: `${Math.max((d.value / max) * 100, d.value > 0 ? 4 : 0)}%` }}
            />
          </div>
          <div className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
            {d.value.toLocaleString("en-IN")}
            {valueSuffix}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Stat tile ─────────────────────────────────────────────────── */
export function StatTile({
  label,
  value,
  hint,
  tone = "normal",
  icon,
}: {
  label: string;
  value: number | string;
  hint?: string;
  tone?: "normal" | "alert" | "good" | "warn";
  icon?: ReactNode;
}) {
  const tones: Record<string, string> = {
    normal: "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950",
    alert: "border-red-300 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30",
    warn: "border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30",
    good: "border-emerald-300 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30",
  };
  const valueTone: Record<string, string> = {
    normal: "text-zinc-900 dark:text-zinc-50",
    alert: "text-red-600 dark:text-red-400",
    warn: "text-amber-600 dark:text-amber-400",
    good: "text-emerald-600 dark:text-emerald-400",
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium leading-tight text-zinc-500 dark:text-zinc-400">
          {label}
        </p>
        {icon && <span className="shrink-0 text-zinc-400">{icon}</span>}
      </div>
      <p className={`mt-1.5 text-3xl font-bold tabular-nums ${valueTone[tone]}`}>
        {typeof value === "number" ? value.toLocaleString("en-IN") : value}
      </p>
      {hint && <p className="mt-0.5 text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

/* ── Legend ────────────────────────────────────────────────────── */
export function Legend({
  items,
}: {
  items: { label: string; value?: number; className: string }[];
}) {
  return (
    <ul className="space-y-1.5">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-2 text-xs">
          <span className={`inline-block h-2.5 w-2.5 rounded-sm ${it.className}`} />
          <span className="text-zinc-600 dark:text-zinc-300">{it.label}</span>
          {it.value !== undefined && (
            <span className="ml-auto font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
              {it.value.toLocaleString("en-IN")}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
