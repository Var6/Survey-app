"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { Card, Empty, inputClass, btnPrimary, btnGhost } from "@/components/ui";
import DailyUpdateForm from "@/components/DailyUpdateForm";
import ReportDetail from "@/components/ReportDetail";

interface Report {
  id: string;
  mobiliserName: string | null;
  period: string;
  periodDate: string;
  metrics: Record<string, number>;
  data: Record<string, unknown>;
  notes: string | null;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  on_track: { label: "ठीक चल रहा है", cls: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300" },
  minor: { label: "मामूली दिक्कतें", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  significant: { label: "बड़ी दिक्कतें", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

export default function ReportsClient({ scope }: { scope: "director" | "cm" }) {
  const isDirector = scope === "director";
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [period, setPeriod] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = isDirector && period ? `?period=${period}` : "";
      const { reports } = await apiFetch<{ reports: Report[] }>(`/api/reports${q}`);
      setRows(reports);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isDirector, period]);

  useEffect(() => {
    load();
  }, [load]);

  // CM: filling a new daily report.
  if (!isDirector && showForm) {
    return (
      <div>
        <button className={`${btnGhost} mb-3`} onClick={() => setShowForm(false)}>
          ← रद्द करें
        </button>
        <DailyUpdateForm
          lang="hi"
          onDone={() => {
            setShowForm(false);
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {!isDirector && (
        <button className={btnPrimary} onClick={() => setShowForm(true)}>
          + नई दैनिक रिपोर्ट
        </button>
      )}
      {isDirector && (
        <select className={inputClass} value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="">All periods</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <Empty>No reports yet.</Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const hasData = r.data && Object.keys(r.data).length > 0;
            const status = STATUS[String(r.data?.overall_status || "")];
            const surveys = r.data?.surveys_completed;
            const isOpen = expanded === r.id;
            return (
              <Card key={r.id}>
                <button
                  className="flex w-full items-start justify-between gap-3 text-left"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                >
                  <div className="min-w-0">
                    <p className="font-semibold capitalize text-zinc-900 dark:text-zinc-50">
                      {r.period} report
                      {isDirector && r.mobiliserName ? ` · ${r.mobiliserName}` : ""}
                    </p>
                    <p className="text-xs text-zinc-400">{formatDate(r.periodDate)}</p>
                    {surveys != null && (
                      <p className="mt-0.5 text-sm text-zinc-500">
                        सर्वे: {String(surveys)}
                        {Array.isArray(r.data?.settlements_worked)
                          ? ` · बस्तियाँ: ${(r.data.settlements_worked as string[]).length}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {status && (
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.cls}`}>
                        {status.label}
                      </span>
                    )}
                    <span className="text-xs text-teal-600 dark:text-teal-400">
                      {isOpen ? "छुपाएँ" : "देखें"}
                    </span>
                  </div>
                </button>

                {isOpen && hasData && <ReportDetail data={r.data} />}

                {isOpen && !hasData && Object.keys(r.metrics).length > 0 && (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Object.entries(r.metrics).map(([k, v]) => (
                      <div key={k} className="rounded-lg bg-zinc-100 px-2 py-1.5 dark:bg-zinc-900">
                        <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">{v}</p>
                        <p className="text-[11px] leading-tight text-zinc-500">{k}</p>
                      </div>
                    ))}
                  </div>
                )}
                {isOpen && r.notes && (
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{r.notes}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
