"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import WeeklyReviewClient from "./WeeklyReviewClient";
import MonthlyReviewClient from "./MonthlyReviewClient";
import ReportDetail from "./ReportDetail";
import { Icon, IconName } from "./icons";

interface DailyReport {
  id: string;
  mobiliserName: string | null;
  periodDate: string;
  data: Record<string, unknown>;
  notes: string | null;
}

type Role = "cm" | "pm";
type RType = "daily" | "weekly" | "monthly";

const ROLE_LABEL: Record<Role, string> = {
  cm: "Community Mobiliser",
  pm: "Programme Manager",
};
const RTYPE_LABEL: Record<RType, string> = {
  daily: "Daily field reports",
  weekly: "Weekly reports",
  monthly: "Monthly reports",
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function dateKey(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function ReportingHub() {
  const [role, setRole] = useState<Role | null>(null);
  const [type, setType] = useState<RType | null>(null);

  const crumb = (label: string, onClick?: () => void, last = false) => (
    <button
      onClick={onClick}
      disabled={last || !onClick}
      className={`${last ? "font-semibold text-zinc-800 dark:text-zinc-100" : "text-teal-600 hover:underline dark:text-teal-400"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-5">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        {crumb(
          "Reports",
          () => {
            setRole(null);
            setType(null);
          },
          !role
        )}
        {role && (
          <>
            <span className="text-zinc-300">/</span>
            {crumb(ROLE_LABEL[role], () => setType(null), !type)}
          </>
        )}
        {role && type && (
          <>
            <span className="text-zinc-300">/</span>
            {crumb(RTYPE_LABEL[type], undefined, true)}
          </>
        )}
      </div>

      {/* Level 1: roles */}
      {!role && (
        <div className="grid gap-4 sm:grid-cols-2">
          <RoleCard
            icon="users"
            title="Community Mobiliser"
            desc="Daily field reports — browse by calendar date"
            onClick={() => setRole("cm")}
          />
          <RoleCard
            icon="report"
            title="Programme Manager"
            desc="Weekly and monthly accountability reports"
            onClick={() => setRole("pm")}
          />
        </div>
      )}

      {/* Level 2: report types for the role */}
      {role && !type && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(role === "cm"
            ? (["daily"] as RType[])
            : (["daily", "weekly", "monthly"] as RType[])
          ).map((t) => (
            <RoleCard
              key={t}
              icon={t === "daily" ? "calendar" : "report"}
              title={RTYPE_LABEL[t]}
              desc={
                t === "daily"
                  ? "Open a calendar and click a date to read that day's reports"
                  : t === "weekly"
                  ? "Review & approve weekly reports"
                  : "Review & approve monthly reports"
              }
              onClick={() => setType(t)}
            />
          ))}
        </div>
      )}

      {/* Level 3: the report view (+ Excel download) */}
      {role && type && (
        <div className="flex justify-end">
          <a
            href={
              type === "daily"
                ? `/api/reports/export?role=${role}`
                : type === "weekly"
                ? "/api/weekly/export"
                : "/api/monthly/export"
            }
            className="rounded-lg border border-teal-600 px-3 py-1.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/30"
          >
            ⬇ Download Excel
          </a>
        </div>
      )}
      {type === "weekly" && <WeeklyReviewClient />}
      {type === "monthly" && <MonthlyReviewClient />}
      {type === "daily" && role && <DailyCalendar role={role} />}
    </div>
  );
}

function RoleCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: IconName;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  const IconCmp = Icon[icon];
  return (
    <button
      onClick={onClick}
      className="group flex items-start gap-3 rounded-2xl border border-zinc-200 bg-white p-5 text-left transition hover:border-teal-400 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-teal-600"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400">
        <IconCmp width={22} height={22} />
      </span>
      <div>
        <p className="font-semibold text-zinc-900 dark:text-zinc-50">{title}</p>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{desc}</p>
      </div>
    </button>
  );
}

function DailyCalendar({ role }: { role: Role }) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selDate, setSelDate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<{ reports: DailyReport[] }>(
        `/api/reports?period=daily&role=${role}`
      );
      setReports(r.reports);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [role]);
  useEffect(() => {
    load();
  }, [load]);

  const byDate = useMemo(() => {
    const m: Record<string, DailyReport[]> = {};
    for (const r of reports) {
      const k = dateKey(r.periodDate);
      (m[k] = m[k] || []).push(r);
    }
    return m;
  }, [reports]);

  const y = cursor.getFullYear();
  const mo = cursor.getMonth();
  const startDow = (new Date(y, mo, 1).getDay() + 6) % 7; // Monday=0
  const daysInMonth = new Date(y, mo + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  const cellKey = (day: number) =>
    `${y}-${String(mo + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const dayReports = selDate ? byDate[selDate] || [] : [];
  const [selReport, setSelReport] = useState<string | null>(null);
  const openDate = (key: string) => {
    setSelDate(key);
    const list = byDate[key] || [];
    // Auto-open when a single mobiliser reported that day.
    setSelReport(list.length === 1 ? list[0].id : null);
  };
  const active = dayReports.find((r) => r.id === selReport) || null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr]">
      {/* Compact calendar (left) */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-2 flex items-center justify-between">
          <button
            onClick={() => setCursor(new Date(y, mo - 1, 1))}
            className="rounded-lg px-2 py-0.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Previous month"
          >
            ‹
          </button>
          <p className="text-xs font-semibold text-zinc-800 dark:text-zinc-100">
            {MONTHS[mo]} {y}
          </p>
          <button
            onClick={() => setCursor(new Date(y, mo + 1, 1))}
            className="rounded-lg px-2 py-0.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-0.5 text-[10px] font-medium text-zinc-400">
              {w.slice(0, 2)}
            </div>
          ))}
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const key = cellKey(day);
            const count = byDate[key]?.length || 0;
            const isSel = selDate === key;
            const isToday = key === dateKey(now.toISOString());
            return (
              <button
                key={i}
                onClick={() => count > 0 && openDate(key)}
                disabled={count === 0}
                title={count > 0 ? `${count} report${count > 1 ? "s" : ""}` : undefined}
                className={`relative flex h-8 items-center justify-center rounded-md text-xs transition ${
                  isSel
                    ? "bg-teal-600 font-bold text-white"
                    : count > 0
                    ? "bg-teal-50 font-semibold text-teal-800 hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-950/70"
                    : "text-zinc-400"
                } ${isToday && !isSel ? "ring-1 ring-zinc-300 dark:ring-zinc-700" : ""}`}
              >
                {day}
                {count > 0 && !isSel && (
                  <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-teal-500" />
                )}
              </button>
            );
          })}
        </div>
        {loading && <p className="mt-2 text-xs text-zinc-400">Loading reports…</p>}
        {err && <p className="mt-2 text-xs text-red-600">{err}</p>}
      </div>

      {/* Right panel: who reported that day → their report */}
      <div className="space-y-3">
        {!selDate ? (
          <p className="rounded-2xl border border-dashed border-zinc-300 py-14 text-center text-sm text-zinc-400 dark:border-zinc-700">
            Pick a highlighted date to see who reported that day.
          </p>
        ) : (
          <>
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
              {formatDate(selDate)} · {dayReports.length} report
              {dayReports.length === 1 ? "" : "s"}
            </h3>
            <div className="flex flex-wrap gap-2">
              {dayReports.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setSelReport(r.id)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    selReport === r.id
                      ? "bg-teal-600 text-white"
                      : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
                  }`}
                >
                  {r.mobiliserName || "Mobiliser"}
                </button>
              ))}
            </div>
            {active ? (
              <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {active.mobiliserName || "Mobiliser"}
                  </p>
                  <button
                    className="rounded px-1.5 py-0.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    onClick={async () => {
                      if (!window.confirm("Delete this daily report permanently?")) return;
                      try {
                        await apiFetch(`/api/reports/${active.id}`, { method: "DELETE" });
                        setSelReport(null);
                        await load();
                      } catch (e) {
                        setErr((e as Error).message);
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
                <ReportDetail data={active.data} />
                {active.notes && (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{active.notes}</p>
                )}
              </div>
            ) : (
              dayReports.length > 1 && (
                <p className="text-sm text-zinc-400">
                  Click a name above to open their report.
                </p>
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
