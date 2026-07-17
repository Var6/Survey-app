"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { Card, Empty, Badge, inputClass, btnGhost } from "@/components/ui";
import { SETTLEMENTS } from "@/lib/questionnaire/settlements";

interface SurveyRow {
  id: string;
  householdId: string;
  settlementLabel: string;
  mobiliserName: string | null;
  headName: string | null;
  totalMembers: number | null;
  status: string;
  sync: { status: string; frappeId: string | null };
  createdAt: string;
}
interface CM {
  id: string;
  name: string;
}

export default function SurveysClient({ scope }: { scope: "director" | "cm" }) {
  const isDirector = scope === "director";
  const [rows, setRows] = useState<SurveyRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [mobilisers, setMobilisers] = useState<CM[]>([]);

  const [mobiliserId, setMobiliserId] = useState("");
  const [settlement, setSettlement] = useState("");
  const [sync, setSync] = useState("");

  const query = useCallback(() => {
    const p = new URLSearchParams();
    if (isDirector && mobiliserId) p.set("mobiliserId", mobiliserId);
    if (settlement) p.set("settlement", settlement);
    if (sync) p.set("sync", sync);
    return p.toString();
  }, [isDirector, mobiliserId, settlement, sync]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { surveys, total } = await apiFetch<{
        surveys: SurveyRow[];
        total: number;
      }>(`/api/surveys?${query()}`);
      setRows(surveys);
      setTotal(total);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (isDirector) {
      apiFetch<{ users: CM[] }>("/api/users")
        .then(({ users }) => setMobilisers(users))
        .catch(() => {});
    }
  }, [isDirector]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {isDirector && (
            <select className={inputClass} value={mobiliserId} onChange={(e) => setMobiliserId(e.target.value)}>
              <option value="">All mobilisers</option>
              {mobilisers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          )}
          <select className={inputClass} value={settlement} onChange={(e) => setSettlement(e.target.value)}>
            <option value="">All settlements</option>
            {SETTLEMENTS.map((s) => (
              <option key={s.code} value={s.code}>{s.label}</option>
            ))}
          </select>
          <select className={inputClass} value={sync} onChange={(e) => setSync(e.target.value)}>
            <option value="">Any sync status</option>
            <option value="synced">Synced</option>
            <option value="unsynced">Not synced</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>
        {isDirector && (
          <a
            href={`/api/surveys/export?${query()}`}
            className={`${btnGhost} mt-3 inline-block`}
          >
            ⬇ Export to Excel
          </a>
        )}
      </Card>

      <p className="text-sm text-zinc-500">
        {loading ? "Loading…" : `${total} survey${total === 1 ? "" : "s"}`}
      </p>
      {err && <p className="text-sm text-red-600">{err}</p>}

      {!loading && rows.length === 0 ? (
        <Empty>No surveys match these filters yet.</Empty>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
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
                    {r.totalMembers != null ? ` · ${r.totalMembers} members` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {isDirector && r.mobiliserName ? `${r.mobiliserName} · ` : ""}
                    {formatDate(r.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge value={r.status} />
                  <Badge value={r.sync.status} />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
