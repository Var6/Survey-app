"use client";

import { SETTLEMENTS } from "@/lib/questionnaire/settlements";
import { inputClass } from "@/components/ui";
import type { SettlementStatus } from "@/lib/models";

const STATUS: Record<string, string> = {
  green: "bg-teal-600 text-white",
  amber: "bg-amber-500 text-white",
  red: "bg-red-600 text-white",
};
const IDLE = "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400";
const LABELS: [SettlementStatus["status"], string][] = [
  ["green", "Green"],
  ["amber", "Amber"],
  ["red", "Red"],
];

export default function SettlementControl({
  value,
  onChange,
  readOnly,
}: {
  value: SettlementStatus[];
  onChange?: (next: SettlementStatus[]) => void;
  readOnly?: boolean;
}) {
  const byCode = new Map(value.map((s) => [s.code, s]));
  const rows: SettlementStatus[] = SETTLEMENTS.map(
    (s) => byCode.get(s.code) || { code: s.code, status: "green" }
  );

  function update(code: string, patch: Partial<SettlementStatus>) {
    onChange?.(rows.map((r) => (r.code === code ? { ...r, ...patch } : r)));
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => {
        const label = SETTLEMENTS.find((s) => s.code === r.code)?.label || r.code;
        const needsReason = r.status === "amber" || r.status === "red";
        return (
          <div key={r.code} className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{label}</span>
              {readOnly ? (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS[r.status]}`}>
                  {r.status}
                </span>
              ) : (
                <div className="flex gap-1">
                  {LABELS.map(([s, txt]) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => update(r.code, { status: s })}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium ${r.status === s ? STATUS[s] : IDLE}`}
                    >
                      {txt}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {needsReason && (
              <div className="mt-2 space-y-2">
                {readOnly ? (
                  <>
                    {r.reason && <p className="text-sm text-zinc-600 dark:text-zinc-300">Reason: {r.reason}</p>}
                    {r.corrective && <p className="text-sm text-zinc-600 dark:text-zinc-300">Action: {r.corrective}</p>}
                  </>
                ) : (
                  <>
                    <input
                      className={inputClass}
                      value={r.reason || ""}
                      onChange={(e) => update(r.code, { reason: e.target.value })}
                      placeholder="Reason (required for Amber/Red)"
                    />
                    <input
                      className={inputClass}
                      value={r.corrective || ""}
                      onChange={(e) => update(r.code, { corrective: e.target.value })}
                      placeholder="Corrective action + owner + deadline"
                    />
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
