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

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => setCursor(new Date(y, mo - 1, 1))}
            className="rounded-lg px-2.5 py-1 text-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Previous month"
          >
            ‹
          </button>
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            {MONTHS[mo]} {y}
          </p>
          <button
            onClick={() => setCursor(new Date(y, mo + 1, 1))}
            className="rounded-lg px-2.5 py-1 text-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            aria-label="Next month"
          >
            ›
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {WEEKDAYS.map((w) => (
            <div key={w} className="pb-1 text-[11px] font-medium text-zinc-400">
              {w}
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
                onClick={() => count > 0 && setSelDate(key)}
                disabled={count === 0}
                className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-sm transition ${
                  isSel
                    ? "border-teal-500 bg-teal-600 text-white"
                    : count > 0
                    ? "border-teal-200 bg-teal-50 text-teal-800 hover:border-teal-400 dark:border-teal-900/60 dark:bg-teal-950/30 dark:text-teal-300"
                    : "border-transparent text-zinc-400"
                } ${isToday && !isSel ? "ring-1 ring-zinc-300 dark:ring-zinc-700" : ""}`}
              >
                <span className={isToday ? "font-bold" : ""}>{day}</span>
                {count > 0 && (
                  <span
                    className={`mt-0.5 rounded-full px-1.5 text-[10px] font-semibold ${
                      isSel ? "bg-white/25" : "bg-teal-600 text-white dark:bg-teal-500"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading && <p className="text-sm text-zinc-400">Loading reports…</p>}

      {selDate && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
            {formatDate(selDate)} · {dayReports.length} report{dayReports.length === 1 ? "" : "s"}
          </h3>
          {dayReports.length === 0 ? (
            <p className="text-sm text-zinc-400">No daily reports on this date.</p>
          ) : (
            dayReports.map((r) => (
              <div
                key={r.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <p className="mb-2 font-semibold text-zinc-900 dark:text-zinc-50">
                  {r.mobiliserName || "Mobiliser"}
                </p>
                <ReportDetail data={r.data} />
                {r.notes && (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{r.notes}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
