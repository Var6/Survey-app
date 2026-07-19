"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { Card, Empty, btnPrimary, btnGhost } from "@/components/ui";
import DailyUpdateForm from "@/components/DailyUpdateForm";
import ReportDetail from "@/components/ReportDetail";

interface Report {
  id: string;
  periodDate: string;
  data: Record<string, unknown>;
}

export default function PmDailyClient() {
  const [rows, setRows] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { reports } = await apiFetch<{ reports: Report[] }>(
        "/api/reports?period=daily&mine=1"
      );
      setRows(reports);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  if (showForm) {
    return (
      <div className="mx-auto max-w-2xl">
        <button className={`${btnGhost} mb-3`} onClick={() => setShowForm(false)}>
          ← Cancel
        </button>
        <DailyUpdateForm
          lang="en"
          onDone={() => {
            setShowForm(false);
            load();
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button className={btnPrimary} onClick={() => setShowForm(true)}>
        + New daily update
      </button>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <Empty>No daily updates yet.</Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const isOpen = expanded === r.id;
            return (
              <Card key={r.id}>
                <button
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                >
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatDate(r.periodDate)}
                  </p>
                  <span className="text-xs text-teal-600 dark:text-teal-400">
                    {isOpen ? "Hide" : "View"}
                  </span>
                </button>
                {isOpen && <ReportDetail data={r.data} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
