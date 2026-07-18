"use client";

import { useEffect, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { labelText, isFieldVisible, type Field, type Option } from "@/lib/questionnaire";
import { WEEKLY_SECTIONS, CERTIFICATION } from "@/lib/weekly/schema";
import type { SettlementStatus } from "@/lib/models";
import { Card, inputClass, labelClass, btnPrimary, btnGhost } from "@/components/ui";
import WeeklyDashboard from "@/components/WeeklyDashboard";
import SettlementControl from "@/components/SettlementControl";

type Values = Record<string, unknown>;
type Cert = Record<string, boolean | string>;

interface Report {
  id: string;
  reportId: string;
  weekStart: string;
  weekEnd: string;
  status: "draft" | "submitted" | "returned" | "approved";
  dashboard: Record<string, unknown> | null;
  settlements: SettlementStatus[];
  data: Values;
  certification: Cert;
  directorComments: string | null;
}

function optLabel(o: Option) {
  return o.hi && o.hi.trim() ? o.hi : o.en;
}

const STATUS_CLS: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  submitted: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  returned: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  approved: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
};

export default function WeeklyReportForm() {
  const [report, setReport] = useState<Report | null>(null);
  const [values, setValues] = useState<Values>({});
  const [settlements, setSettlements] = useState<SettlementStatus[]>([]);
  const [cert, setCert] = useState<Cert>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  useEffect(() => {
    apiFetch<{ report: Report }>("/api/weekly", { method: "POST", body: "{}" })
      .then(({ report }) => {
        setReport(report);
        setValues(report.data || {});
        setSettlements(report.settlements || []);
        setCert(report.certification || {});
      })
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const editable = report?.status === "draft" || report?.status === "returned";
  const setValue = (n: string, v: unknown) => setValues((s) => ({ ...s, [n]: v }));

  async function save(): Promise<boolean> {
    if (!report) return false;
    setErr(null);
    setMsg(null);
    setSaving(true);
    try {
      await apiFetch(`/api/weekly/${report.id}`, {
        method: "PATCH",
        body: JSON.stringify({ data: values, settlements, certification: cert }),
      });
      setMsg("Draft saved");
      return true;
    } catch (e) {
      setErr((e as Error).message);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    if (!report) return;
    setIssues([]);
    setErr(null);
    const ok = await save();
    if (!ok) return;
    const res = await fetch(`/api/weekly/${report.id}/submit`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (Array.isArray(data.issues)) setIssues(data.issues);
      setErr(data.error || "Submit failed");
      return;
    }
    setReport(data.report as Report);
    setMsg("Submitted to Director ✓");
  }

  function renderField(field: Field) {
    if (!isFieldVisible(field, values)) return null;
    const value = values[field.name];
    let control: React.ReactNode;
    if (field.type === "select") {
      control = (
        <select className={inputClass} value={(value as string) || ""} disabled={!editable} onChange={(e) => setValue(field.name, e.target.value)}>
          <option value="">— select —</option>
          {(field.options || []).map((op) => (
            <option key={op.code} value={op.code}>{optLabel(op)}</option>
          ))}
        </select>
      );
    } else if (field.type === "multiselect") {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div className="grid grid-cols-2 gap-1.5">
          {(field.options || []).map((op) => (
            <label key={op.code} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800">
              <input type="checkbox" disabled={!editable} checked={arr.includes(op.code)} onChange={() => setValue(field.name, arr.includes(op.code) ? arr.filter((x) => x !== op.code) : [...arr, op.code])} />
              <span className="text-zinc-700 dark:text-zinc-300">{optLabel(op)}</span>
            </label>
          ))}
        </div>
      );
    } else if (field.type === "integer") {
      control = <input className={inputClass} type="text" inputMode="numeric" readOnly={!editable} value={value === undefined || value === null ? "" : String(value)} onChange={(e) => setValue(field.name, e.target.value.replace(/[^\d]/g, ""))} />;
    } else if (field.type === "textarea") {
      control = <textarea className={inputClass} rows={2} readOnly={!editable} value={(value as string) || ""} onChange={(e) => setValue(field.name, e.target.value)} />;
    } else {
      control = <input className={inputClass} readOnly={!editable} value={(value as string) || ""} onChange={(e) => setValue(field.name, e.target.value)} />;
    }
    return (
      <div key={field.name}>
        <label className={labelClass}>
          {labelText(field.label)}
          {field.required && <span className="text-red-500"> *</span>}
        </label>
        {control}
      </div>
    );
  }

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;
  if (!report) return <p className="text-sm text-red-600">{err || "Could not open the report."}</p>;

  return (
    <div className="space-y-5 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-bold text-zinc-900 dark:text-zinc-50">{report.reportId}</p>
          <p className="text-xs text-zinc-500">{formatDate(report.weekStart)} – {formatDate(report.weekEnd)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_CLS[report.status]}`}>{report.status}</span>
      </div>

      {report.status === "returned" && report.directorComments && (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          Returned by Director: {report.directorComments}
        </div>
      )}

      {/* Section A/D — auto dashboard */}
      <div>
        <h2 className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">Weekly command dashboard (auto)</h2>
        {/* @ts-expect-error dashboard is a loose shape */}
        <WeeklyDashboard dashboard={report.dashboard} />
      </div>

      {/* Section B — settlement control */}
      <div>
        <h2 className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">Settlement control (traffic-light)</h2>
        <SettlementControl value={settlements} onChange={setSettlements} readOnly={!editable} />
      </div>

      {/* Accountability sections */}
      {WEEKLY_SECTIONS.map((section) => (
        <div key={section.id} className="space-y-3">
          <div className="flex items-center gap-2 border-b border-zinc-200 pb-1 dark:border-zinc-800">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-teal-100 text-xs font-bold text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">{section.id}</span>
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{labelText(section.title)}</h2>
          </div>
          {section.items.map((f) => renderField(f as Field))}
        </div>
      ))}

      {/* Section N — certification */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 border-b border-zinc-200 pb-1 dark:border-zinc-800">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-teal-100 text-xs font-bold text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">N</span>
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Certification</h2>
        </div>
        {CERTIFICATION.map((c) => (
          <label key={c.key} className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input type="checkbox" className="mt-1" disabled={!editable} checked={!!cert[c.key]} onChange={(e) => setCert((s) => ({ ...s, [c.key]: e.target.checked }))} />
            <span>{c.label}</span>
          </label>
        ))}
        <div>
          <label className={labelClass}>Final comment</label>
          <textarea className={inputClass} rows={2} readOnly={!editable} value={(cert.final_comment as string) || ""} onChange={(e) => setCert((s) => ({ ...s, final_comment: e.target.value }))} />
        </div>
      </div>

      {issues.length > 0 && (
        <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <p className="font-semibold">Fix before submitting:</p>
          <ul className="ml-4 list-disc">{issues.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
      )}
      {msg && <p className="text-sm text-teal-700 dark:text-teal-400">{msg}</p>}
      {err && issues.length === 0 && <p className="text-sm text-red-600">{err}</p>}

      {editable && (
        <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
          <div className="mx-auto flex max-w-3xl gap-2">
            <button className={`${btnGhost} flex-1`} onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save draft"}
            </button>
            <button className={`${btnPrimary} flex-[2]`} onClick={submit} disabled={saving}>
              Submit to Director
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
