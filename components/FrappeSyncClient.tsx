"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { Card, Empty, btnGhost } from "@/components/ui";

interface FieldRow {
  frappe: string;
  source: string;
  label: string;
  filled?: number;
}
interface Status {
  configured: boolean;
  counts: { total: number; synced: number; pending: number; failed: number; sampled: number };
  members: { inApp: number; pushed: number };
  household: FieldRow[];
  member: FieldRow[];
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return (
    <div className="rounded-lg bg-zinc-100 px-3 py-2 dark:bg-zinc-900">
      <p className={`text-xl font-bold ${tone || "text-zinc-900 dark:text-zinc-100"}`}>{value}</p>
      <p className="text-[11px] leading-tight text-zinc-500">{label}</p>
    </div>
  );
}

export default function FrappeSyncClient() {
  const [s, setS] = useState<Status | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setS(await apiFetch<Status>("/api/frappe/status"));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function retryFailed(all = false) {
    setRetrying(true);
    setMsg(null);
    try {
      const r = await apiFetch<{ attempted?: number; synced?: number; remaining?: number }>(
        `/api/surveys/sync-failed${all ? "?scope=all" : ""}`,
        { method: "POST" }
      );
      setMsg(
        `Sent ${r.synced ?? 0} of ${r.attempted ?? 0} households` +
          (r.remaining ? ` — ${r.remaining} still to go, run it again.` : ".")
      );
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setRetrying(false);
    }
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (err) return <p className="text-sm text-red-600">{err}</p>;
  if (!s) return <Empty>No sync information.</Empty>;

  return (
    <div className="space-y-5">
      {!s.configured && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          Frappe is not configured on this environment, so nothing is being sent.
        </p>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Stat label="Households in app" value={s.counts.total} />
          <Stat label="Sent to funder" value={s.counts.synced} tone="text-teal-700 dark:text-teal-400" />
          <Stat label="Waiting" value={s.counts.pending} />
          <Stat label="Failed" value={s.counts.failed} tone={s.counts.failed ? "text-red-600" : undefined} />
          <Stat label="Member records sent" value={s.members.pushed} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {s.counts.failed > 0 && (
            <button className={btnGhost} onClick={() => retryFailed(false)} disabled={retrying}>
              {retrying ? "Sending…" : `Re-send ${s.counts.failed} failed`}
            </button>
          )}
          <button className={btnGhost} onClick={() => retryFailed(true)} disabled={retrying}>
            {retrying ? "Sending…" : "Backfill 50 households"}
          </button>
          {msg && <span className="text-sm text-teal-700 dark:text-teal-400">{msg}</span>}
        </div>
        <p className="mt-1.5 text-xs text-zinc-500">
          Backfill re-sends already-synced households so the newly mapped fields and the
          family member records reach the funder. It works in batches of 50 and updates
          existing records rather than creating duplicates — run it until nothing is left.
        </p>
      </Card>

      <div>
        <h2 className="mb-1 text-sm font-bold text-zinc-900 dark:text-zinc-50">
          Household fields going to the funder
        </h2>
        <p className="mb-2 text-xs text-zinc-500">
          “Carrying a value” counts the {s.counts.sampled} most recently synced households. A
          mapped field at 0 means the question exists but nobody has answered it yet.
        </p>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left dark:border-zinc-800">
                  <th className="py-1.5 pr-3 font-semibold">Funder field</th>
                  <th className="py-1.5 pr-3 font-semibold">From this question</th>
                  <th className="py-1.5 text-right font-semibold">Carrying a value</th>
                </tr>
              </thead>
              <tbody>
                {s.household.map((f) => {
                  const pct = s.counts.sampled ? Math.round(((f.filled || 0) / s.counts.sampled) * 100) : 0;
                  return (
                    <tr key={f.frappe} className="border-b border-zinc-100 dark:border-zinc-900">
                      <td className="py-1.5 pr-3">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">{f.label}</span>
                        <span className="block text-[11px] text-zinc-400">{f.frappe}</span>
                      </td>
                      <td className="py-1.5 pr-3 text-xs text-zinc-500">{f.source}</td>
                      <td className="py-1.5 text-right">
                        <span
                          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
                            pct === 0
                              ? "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                              : pct < 50
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300"
                          }`}
                        >
                          {f.filled || 0} / {s.counts.sampled}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="mb-1 text-sm font-bold text-zinc-900 dark:text-zinc-50">
          Family member fields
        </h2>
        <p className="mb-2 text-xs text-zinc-500">
          Every person in the household roster is sent as a Family Member record, matched on
          household ID and name so a re-sync updates instead of duplicating.
          {" "}
          {s.members.inApp} member rows in the sampled households.
        </p>
        <Card>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {s.member.map((f) => (
              <div key={f.frappe} className="flex justify-between gap-3 text-sm">
                <span className="text-zinc-800 dark:text-zinc-200">{f.label}</span>
                <span className="text-[11px] text-zinc-400">{f.frappe}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
