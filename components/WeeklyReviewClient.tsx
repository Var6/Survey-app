"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { labelText, type Field } from "@/lib/questionnaire";
import { WEEKLY_SECTIONS, CERTIFICATION } from "@/lib/weekly/schema";
import type { SettlementStatus } from "@/lib/models";
import { Card, Empty, inputClass, labelClass, btnPrimary, btnGhost } from "@/components/ui";
import WeeklyDashboard from "@/components/WeeklyDashboard";
import SettlementControl from "@/components/SettlementControl";

interface Report {
  id: string;
  reportId: string;
  pmName: string | null;
  weekStart: string;
  weekEnd: string;
  status: string;
  dashboard: Record<string, unknown> | null;
  settlements: SettlementStatus[];
  data: Record<string, unknown>;
  certification: Record<string, boolean | string>;
  directorComments: string | null;
}

function optLabel(field: Field, code: string) {
  const op = field.options?.find((o) => o.code === code);
  return op ? op.hi || op.en : code;
}
function display(field: Field, val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  if (field.type === "multiselect" && Array.isArray(val)) return val.length ? val.map((c) => optLabel(field, String(c))).join(", ") : null;
  if (field.type === "select") return optLabel(field, String(val));
  return String(val);
}

const STATUS_CLS: Record<string, string> = {
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  returned: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

export default function WeeklyReviewClient() {
  const [rows, setRows] = useState<Report[]>([]);
  const [status, setStatus] = useState("submitted");
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Report | null>(null);
  const [comments, setComments] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = status ? `?status=${status}` : "";
      const { reports } = await apiFetch<{ reports: Report[] }>(`/api/weekly${q}`);
      setRows(reports);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [status]);
  useEffect(() => {
    load();
  }, [load]);

  async function open(id: string) {
    setErr(null);
    setComments("");
    const { report } = await apiFetch<{ report: Report }>(`/api/weekly/${id}`);
    setSel(report);
  }

  async function review(action: "approve" | "return") {
    if (!sel) return;
    try {
      await apiFetch(`/api/weekly/${sel.id}/review`, {
        method: "POST",
        body: JSON.stringify({ action, comments }),
      });
      setSel(null);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (sel) {
    return (
      <div className="space-y-5">
        <button className={btnGhost} onClick={() => setSel(null)}>← Back to list</button>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-bold text-zinc-900 dark:text-zinc-50">{sel.reportId}</p>
            <p className="text-xs text-zinc-500">{sel.pmName} · {formatDate(sel.weekStart)} – {formatDate(sel.weekEnd)}</p>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_CLS[sel.status]}`}>{sel.status}</span>
        </div>

        {/* @ts-expect-error loose dashboard shape */}
        <WeeklyDashboard dashboard={sel.dashboard} />

        <div>
          <h3 className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">Settlement control</h3>
          <SettlementControl value={sel.settlements} readOnly />
        </div>

        {WEEKLY_SECTIONS.map((section) => {
          const items = section.items
            .map((f) => {
              const field = f as Field;
              const v = display(field, sel.data[field.name]);
              return v ? { label: labelText(field.label), value: v } : null;
            })
            .filter(Boolean) as { label: string; value: string }[];
          if (!items.length) return null;
          return (
            <Card key={section.id}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{labelText(section.title)}</p>
              <dl className="space-y-1">
                {items.map((r) => (
                  <div key={r.label} className="text-sm">
                    <dt className="text-zinc-500">{r.label}</dt>
                    <dd className="font-medium text-zinc-800 dark:text-zinc-200">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          );
        })}

        <Card>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Certification</p>
          {CERTIFICATION.map((c) => (
            <p key={c.key} className="text-sm text-zinc-700 dark:text-zinc-300">
              {sel.certification[c.key] ? "☑" : "☐"} {c.label}
            </p>
          ))}
          {sel.certification.final_comment && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{String(sel.certification.final_comment)}</p>
          )}
        </Card>

        {sel.status === "submitted" && (
          <Card>
            <label className={labelClass}>Director comments / action points</label>
            <textarea className={inputClass} rows={3} value={comments} onChange={(e) => setComments(e.target.value)} placeholder="Comments, decisions, action points…" />
            {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
            <div className="mt-3 flex gap-2">
              <button className={btnPrimary} onClick={() => review("approve")}>Approve</button>
              <button className={btnGhost} onClick={() => review("return")}>Return for correction</button>
            </div>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
        <option value="submitted">Submitted (to review)</option>
        <option value="approved">Approved</option>
        <option value="returned">Returned</option>
        <option value="">All</option>
      </select>
      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <Empty>No weekly reports here.</Empty>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex items-center gap-3">
                <button className="flex flex-1 items-center justify-between gap-3 text-left" onClick={() => open(r.id)}>
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">{r.reportId}</p>
                    <p className="text-xs text-zinc-500">{r.pmName} · {formatDate(r.weekStart)} – {formatDate(r.weekEnd)}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_CLS[r.status]}`}>{r.status}</span>
                </button>
                <button
                  className="rounded px-1.5 py-0.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={async () => {
                    if (!window.confirm(`Delete weekly report ${r.reportId} permanently?`)) return;
                    try {
                      await apiFetch(`/api/weekly/${r.id}`, { method: "DELETE" });
                      await load();
                    } catch (e) {
                      setErr((e as Error).message);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
