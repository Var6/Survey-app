"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client";
import {
  labelText,
  isFieldVisible,
  isFieldRequired,
  validateField,
  type Field,
  type Option,
} from "@/lib/questionnaire";
import { REPORT_SECTIONS } from "@/lib/reports/schema";
import { inputClass, labelClass, btnPrimary } from "@/components/ui";

type Values = Record<string, unknown>;

function optLabel(o: Option): string {
  return o.hi && o.hi.trim() ? o.hi : o.en;
}
function cleanInt(field: Field, raw: string): number | "" {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits === "") return "";
  let n = parseInt(digits, 10);
  const max = field.validation?.max;
  if (max !== undefined && n > max) n = max;
  return n;
}

export default function ReportForm({ onDone }: { onDone: () => void }) {
  const [values, setValues] = useState<Values>({
    report_date: new Date().toISOString().slice(0, 10),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  const setValue = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  function renderField(field: Field) {
    if (!isFieldVisible(field, values)) return null;
    const value = values[field.name];
    const required = isFieldRequired(field, values);
    const err = errors[field.name];

    let control: React.ReactNode;
    if (field.type === "select") {
      control = (
        <select className={inputClass} value={(value as string) || ""} onChange={(e) => setValue(field.name, e.target.value)}>
          <option value="">— चुनें —</option>
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
              <input
                type="checkbox"
                checked={arr.includes(op.code)}
                onChange={() =>
                  setValue(field.name, arr.includes(op.code) ? arr.filter((x) => x !== op.code) : [...arr, op.code])
                }
              />
              <span className="text-zinc-700 dark:text-zinc-300">{optLabel(op)}</span>
            </label>
          ))}
        </div>
      );
    } else if (field.type === "textarea") {
      control = <textarea className={inputClass} rows={2} value={(value as string) || ""} onChange={(e) => setValue(field.name, e.target.value)} />;
    } else if (field.type === "integer" || field.type === "decimal") {
      const strVal = value === "" || value === undefined || value === null ? "" : String(value);
      control = (
        <input
          className={inputClass}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={strVal}
          onChange={(e) => setValue(field.name, cleanInt(field, e.target.value))}
        />
      );
    } else {
      const type = field.type === "date" ? "date" : "text";
      control = <input className={inputClass} type={type} value={(value as string) || ""} onChange={(e) => setValue(field.name, e.target.value)} />;
    }

    return (
      <div key={field.name}>
        <label className={labelClass}>
          {labelText(field.label)}
          {required && <span className="text-red-500"> *</span>}
        </label>
        {control}
        {err && <p className="mt-0.5 text-xs text-red-500">{err}</p>}
      </div>
    );
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    for (const section of REPORT_SECTIONS) {
      for (const item of section.items) {
        const f = item as Field;
        if (!isFieldVisible(f, values)) continue;
        const msg = validateField(f, values[f.name], values);
        if (msg) errs[f.name] = msg;
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    if (!validate()) {
      setTopError("कृपया लाल निशान वाले सवाल पूरे करें।");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          period: "daily",
          periodDate: values.report_date,
          data: values,
          notes: (values.notes as string) || undefined,
        }),
      });
      onDone();
    } catch (err) {
      setTopError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6 pb-24">
      {topError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {topError}
        </p>
      )}

      {REPORT_SECTIONS.map((section) => {
        const visible = section.items.filter((f) => isFieldVisible(f as Field, values));
        if (visible.length === 0) return null;
        return (
          <section key={section.id} className="space-y-3">
            <div className="flex items-center gap-2 border-b border-zinc-200 pb-1 dark:border-zinc-800">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-teal-100 text-xs font-bold text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
                {section.id}
              </span>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
                {labelText(section.title)}
              </h2>
            </div>
            {section.items.map((f) => renderField(f as Field))}
          </section>
        );
      })}

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <div className="mx-auto max-w-3xl">
          <button type="submit" className={`${btnPrimary} w-full`} disabled={submitting}>
            {submitting ? "सेव हो रहा है…" : "रिपोर्ट सेव करें"}
          </button>
        </div>
      </div>
    </form>
  );
}
