"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { Card, Empty, inputClass, labelClass, btnPrimary } from "@/components/ui";

interface Report {
  id: string;
  mobiliserName: string | null;
  period: string;
  periodDate: string;
  metrics: Record<string, number>;
  notes: string | null;
}

const METRICS: [string, string][] = [
  ["householdsVisited", "Households visited"],
  ["surveysDone", "Surveys done"],
  ["youthMeetings", "Youth meetings"],
  ["womenMeetings", "Women / girls meetings"],
  ["childrenActivities", "Children activities"],
  ["enrolmentsSupported", "Enrolments supported"],
  ["entitlementsFollowedUp", "Entitlements followed up"],
  ["healthReferrals", "Health referrals"],
];
const METRIC_LABEL = Object.fromEntries(METRICS);

export default function ReportsClient({ scope }: { scope: "director" | "cm" }) {
  const isDirector = scope === "director";
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [period, setPeriod] = useState("");

  // CM form
  const [showForm, setShowForm] = useState(false);
  const [fPeriod, setFPeriod] = useState("daily");
  const [fDate, setFDate] = useState(new Date().toISOString().slice(0, 10));
  const [metrics, setMetrics] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

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

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    const numericMetrics: Record<string, number> = {};
    for (const [k, v] of Object.entries(metrics)) {
      const n = Number(v);
      if (v !== "" && Number.isFinite(n)) numericMetrics[k] = n;
    }
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          period: fPeriod,
          periodDate: fDate,
          metrics: numericMetrics,
          notes,
        }),
      });
      setMetrics({});
      setNotes("");
      setShowForm(false);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {!isDirector && (
        <button className={btnPrimary} onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ New report"}
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

      {showForm && !isDirector && (
        <Card>
          <form onSubmit={create} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Period</label>
                <select className={inputClass} value={fPeriod} onChange={(e) => setFPeriod(e.target.value)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Date</label>
                <input className={inputClass} type="date" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {METRICS.map(([key, label]) => (
                <div key={key}>
                  <label className={labelClass}>{label}</label>
                  <input
                    className={inputClass}
                    type="number"
                    min="0"
                    value={metrics[key] ?? ""}
                    onChange={(e) => setMetrics((m) => ({ ...m, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div>
              <label className={labelClass}>Notes</label>
              <textarea className={inputClass} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? "Saving…" : "Submit report"}
            </button>
          </form>
        </Card>
      )}

      {err && !showForm && <p className="text-sm text-red-600">{err}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <Empty>No reports {isDirector ? "submitted yet" : "yet"}.</Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center justify-between">
                <p className="font-semibold capitalize text-zinc-900 dark:text-zinc-50">
                  {r.period} report
                </p>
                <p className="text-xs text-zinc-400">{formatDate(r.periodDate)}</p>
              </div>
              {isDirector && r.mobiliserName && (
                <p className="text-sm text-zinc-500">{r.mobiliserName}</p>
              )}
              {Object.keys(r.metrics).length > 0 && (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {Object.entries(r.metrics).map(([k, v]) => (
                    <div key={k} className="rounded-lg bg-zinc-100 px-2 py-1.5 dark:bg-zinc-900">
                      <p className="text-base font-bold text-zinc-900 dark:text-zinc-100">{v}</p>
                      <p className="text-[11px] leading-tight text-zinc-500">
                        {METRIC_LABEL[k] || k}
                      </p>
                    </div>
                  ))}
                </div>
              )}
              {r.notes && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{r.notes}</p>}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
