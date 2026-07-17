"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { Card, Empty, Badge, btnPrimary, btnGhost } from "@/components/ui";

interface SurveyRow {
  id: string;
  householdId: string;
  settlementLabel: string;
  mobiliserName: string | null;
  headName: string | null;
  sync: { status: string; frappeId: string | null; error: string | null };
  createdAt: string;
}

export default function SyncClient() {
  const [total, setTotal] = useState(0);
  const [unsynced, setUnsynced] = useState<SurveyRow[]>([]);
  const [unsyncedTotal, setUnsyncedTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const all = await apiFetch<{ total: number }>("/api/surveys?limit=1");
      setTotal(all.total);
      const u = await apiFetch<{ surveys: SurveyRow[]; total: number }>(
        "/api/surveys?sync=unsynced&limit=100"
      );
      setUnsynced(u.surveys);
      setUnsyncedTotal(u.total);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function resyncOne(id: string) {
    setBusy(id);
    setErr(null);
    setMsg(null);
    try {
      await apiFetch(`/api/surveys/${id}/sync`, { method: "POST" });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function resyncAll() {
    setBusy("all");
    setErr(null);
    setMsg(null);
    try {
      const res = await apiFetch<{ attempted: number; synced: number; failed: number }>(
        "/api/surveys/sync-failed",
        { method: "POST" }
      );
      setMsg(`Re-synced ${res.synced}/${res.attempted}. ${res.failed} still failing.`);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">{total}</p>
          <p className="text-xs text-zinc-500">Total surveys</p>
        </Card>
        <Card>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
            {unsyncedTotal}
          </p>
          <p className="text-xs text-zinc-500">Awaiting / failed sync</p>
        </Card>
      </div>

      <div className="flex items-center gap-2">
        <button className={btnPrimary} onClick={resyncAll} disabled={busy === "all"}>
          {busy === "all" ? "Re-syncing…" : "Re-sync all failed"}
        </button>
        <button className={btnGhost} onClick={load}>
          Refresh
        </button>
      </div>
      {msg && <p className="text-sm text-teal-700 dark:text-teal-400">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : unsynced.length === 0 ? (
        <Empty>Everything is synced to Frappe. 🎉</Empty>
      ) : (
        <div className="space-y-2">
          {unsynced.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {r.headName || "—"}{" "}
                    <span className="text-xs font-normal text-zinc-400">
                      {r.householdId}
                    </span>
                  </p>
                  <p className="text-sm text-zinc-500">
                    {r.settlementLabel}
                    {r.mobiliserName ? ` · ${r.mobiliserName}` : ""}
                  </p>
                  {r.sync.error && (
                    <p className="mt-0.5 truncate text-xs text-red-500" title={r.sync.error}>
                      {r.sync.error}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge value={r.sync.status} />
                  <button
                    className={btnGhost}
                    onClick={() => resyncOne(r.id)}
                    disabled={busy === r.id}
                  >
                    {busy === r.id ? "…" : "Re-sync"}
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
