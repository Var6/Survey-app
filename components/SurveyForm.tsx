"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/client";
import {
  QUESTIONNAIRE,
  labelText,
  isRepeat,
  isFieldVisible,
  isFieldRequired,
  evalCondition,
  validateField,
  type Field,
  type Option,
  type RepeatGroup,
} from "@/lib/questionnaire";
import { inputClass, labelClass, btnPrimary } from "@/components/ui";
import { MOBILISER_CODES } from "@/lib/questionnaire/settlements";

type Values = Record<string, unknown>;
type Rows = Record<string, Values[]>;

const REPEAT_CAP = 40;

function optLabel(o: Option): string {
  return o.hi && o.hi.trim() ? o.hi : o.en;
}

export default function SurveyForm({
  role,
  settlementOptions,
  mobiliserCode,
  mobiliserName,
  projects = [],
}: {
  role: "cm" | "director";
  settlementOptions: { code: string; label: string }[];
  mobiliserCode?: string;
  mobiliserName?: string;
  projects?: { id: string; name: string }[];
}) {
  const router = useRouter();

  const initial = useMemo<Values>(() => {
    const v: Values = {
      form_version: "V0.1",
      survey_date: new Date().toISOString().slice(0, 10),
    };
    if (mobiliserName) v.mobiliser_name = mobiliserName;
    if (mobiliserCode) v.mobiliser_code = mobiliserCode;
    if (settlementOptions.length === 1) v.settlement_name = settlementOptions[0].code;
    return v;
  }, [mobiliserName, mobiliserCode, settlementOptions]);

  const [values, setValues] = useState<Values>(initial);
  const [rows, setRows] = useState<Rows>({});
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [topError, setTopError] = useState<string | null>(null);

  function setValue(name: string, value: unknown) {
    setValues((v) => ({ ...v, [name]: value }));
  }
  function setRow(group: string, index: number, name: string, value: unknown) {
    setRows((prev) => {
      const arr = (prev[group] || []).slice();
      arr[index] = { ...(arr[index] || {}), [name]: value };
      return { ...prev, [group]: arr };
    });
  }

  function toggleMulti(name: string, code: string, current: unknown) {
    const arr = Array.isArray(current) ? (current as string[]) : [];
    setValue(name, arr.includes(code) ? arr.filter((x) => x !== code) : [...arr, code]);
  }

  async function captureGps(name: string) {
    if (!navigator.geolocation) {
      setValue(name, null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setValue(name, {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      () => setTopError("Could not get location — you can continue without it.")
    );
  }

  /* ── Field renderer ─────────────────────────────────────── */
  function renderField(
    field: Field,
    ctx: Values,
    value: unknown,
    onChange: (v: unknown) => void,
    keyPrefix: string
  ) {
    const required = isFieldRequired(field, ctx);
    const err = errors[keyPrefix + field.name];
    const label = (
      <label className={labelClass}>
        {labelText(field.label)}
        {required && <span className="text-red-500"> *</span>}
      </label>
    );

    // Special: settlement dropdown uses provided options.
    let options = field.options;
    if (field.name === "settlement_name") {
      options = settlementOptions.map((s) => ({ code: s.code, en: s.label }));
    }

    let control: React.ReactNode;

    if (field.type === "note") {
      return (
        <div key={keyPrefix + field.name} className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-900 dark:bg-teal-950/30 dark:text-teal-200">
          {labelText(field.label)}
          {field.note && <span className="block text-xs opacity-80">{field.note}</span>}
        </div>
      );
    }

    if (field.name === "mobiliser_name") {
      control = (
        <input
          className={inputClass}
          value={(value as string) || ""}
          readOnly={role === "cm"}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    } else if (field.name === "mobiliser_code" && role === "cm" && mobiliserCode) {
      control = <input className={inputClass} value={String(value || "")} readOnly />;
    } else if (field.type === "select" || (field.name === "mobiliser_code")) {
      const opts = field.name === "mobiliser_code" && (!options || options.length === 0)
        ? MOBILISER_CODES.map((c) => ({ code: c, en: c }))
        : options || [];
      control = (
        <select className={inputClass} value={(value as string) || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">— select —</option>
          {opts.map((o) => (
            <option key={o.code} value={o.code}>{optLabel(o)}</option>
          ))}
        </select>
      );
    } else if (field.type === "multiselect") {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div className="grid grid-cols-2 gap-1.5">
          {(options || []).map((o) => (
            <label key={o.code} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800">
              <input type="checkbox" checked={arr.includes(o.code)} onChange={() => onChange(arr.includes(o.code) ? arr.filter((x) => x !== o.code) : [...arr, o.code])} />
              <span className="text-zinc-700 dark:text-zinc-300">{optLabel(o)}</span>
            </label>
          ))}
        </div>
      );
    } else if (field.type === "textarea") {
      control = <textarea className={inputClass} rows={2} value={(value as string) || ""} onChange={(e) => onChange(e.target.value)} />;
    } else if (field.type === "geopoint") {
      const g = value as { lat: number; lng: number } | null;
      control = (
        <div className="flex items-center gap-2">
          <button type="button" className={inputClass + " !w-auto"} onClick={() => captureGps(field.name)}>
            📍 Capture location
          </button>
          {g && <span className="text-xs text-zinc-500">{g.lat.toFixed(5)}, {g.lng.toFixed(5)}</span>}
        </div>
      );
    } else {
      const type =
        field.type === "integer" || field.type === "decimal"
          ? "number"
          : field.type === "date"
          ? "date"
          : field.type === "time"
          ? "time"
          : field.type === "phone"
          ? "tel"
          : "text";
      control = (
        <input
          className={inputClass}
          type={type}
          inputMode={type === "number" ? "numeric" : type === "tel" ? "tel" : undefined}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(field.type === "integer" || field.type === "decimal" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value)}
        />
      );
    }

    return (
      <div key={keyPrefix + field.name}>
        {label}
        {control}
        {field.note && (
          <p className="mt-0.5 text-xs text-zinc-400">{field.note}</p>
        )}
        {err && <p className="mt-0.5 text-xs text-red-500">{err}</p>}
      </div>
    );
  }

  function renderRepeat(group: RepeatGroup) {
    if (!evalCondition(group.showWhen, values)) return null;
    const count = Math.min(Number(values[group.countFrom]) || 0, REPEAT_CAP);
    if (count <= 0) {
      return (
        <p key={group.name} className="text-sm text-zinc-400">
          Set “{group.countFrom.replace(/_/g, " ")}” above to add entries.
        </p>
      );
    }
    return (
      <div key={group.name} className="space-y-3">
        {Array.from({ length: count }).map((_, i) => {
          const row = (rows[group.name] || [])[i] || {};
          const ctx = { ...values, ...row };
          return (
            <div key={i} className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                {labelText(group.label)} #{i + 1}
              </p>
              <div className="space-y-3">
                {group.fields
                  .filter((f) => isFieldVisible(f, ctx))
                  .map((f) =>
                    renderField(f, ctx, row[f.name], (v) => setRow(group.name, i, f.name, v), `${group.name}.${i}.`)
                  )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    for (const section of QUESTIONNAIRE) {
      if (!evalCondition(section.showWhen, values)) continue;
      for (const item of section.items) {
        if (isRepeat(item)) {
          if (!evalCondition(item.showWhen, values)) continue;
          const count = Math.min(Number(values[item.countFrom]) || 0, REPEAT_CAP);
          for (let i = 0; i < count; i++) {
            const row = (rows[item.name] || [])[i] || {};
            const ctx = { ...values, ...row };
            for (const f of item.fields) {
              if (f.type === "note") continue;
              const msg = validateField(f, row[f.name], ctx);
              if (msg) errs[`${item.name}.${i}.${f.name}`] = msg;
            }
          }
        } else if (item.type !== "note") {
          const msg = validateField(item, values[item.name], values);
          if (msg) errs[item.name] = msg;
        }
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTopError(null);
    if (role === "director" && !projectId) {
      setTopError("Select a project for this survey.");
      return;
    }
    if (!validate()) {
      setTopError("Please fix the highlighted fields.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setSubmitting(true);
    try {
      const countOf = (n: string) => Math.min(Number(values[n]) || 0, REPEAT_CAP);
      const slice = (name: string, n: string) =>
        Array.from({ length: countOf(n) }, (_, i) => (rows[name] || [])[i] || {});

      await apiFetch("/api/surveys", {
        method: "POST",
        body: JSON.stringify({
          settlementCode: values.settlement_name,
          mobiliserCode: values.mobiliser_code,
          projectId: role === "director" ? projectId : undefined,
          formVersion: values.form_version || "V0.1",
          status: (values.form_complete_status as string) || "complete",
          data: values,
          members: slice("household_members", "hh_total_members"),
          children_0_3: slice("children_0_3", "num_children_0_3"),
          children_4_12: slice("children_4_12", "num_children_4_12"),
          youth_13_24: slice("youth_13_24", "num_youth_13_24"),
          gps: (values.gps_location as object) || null,
        }),
      });
      router.replace(role === "director" ? "/director/surveys" : "/cm/surveys");
      router.refresh();
    } catch (e) {
      setTopError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6 pb-24">
      {topError && (
        <p className="sticky top-2 z-10 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {topError}
        </p>
      )}

      {role === "director" && (
        <div>
          <label className={labelClass}>Project *</label>
          <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="">— select project —</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {QUESTIONNAIRE.map((section) => {
        if (!evalCondition(section.showWhen, values)) return null;
        const items = section.items.filter((it) =>
          isRepeat(it) ? true : isFieldVisible(it, values)
        );
        if (items.length === 0) return null;
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
            {section.items.map((item) =>
              isRepeat(item)
                ? renderRepeat(item)
                : isFieldVisible(item, values)
                ? renderField(item, values, values[item.name], (v) => setValue(item.name, v), "")
                : null
            )}
          </section>
        );
      })}

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <div className="mx-auto max-w-3xl">
          <button type="submit" className={`${btnPrimary} w-full`} disabled={submitting}>
            {submitting ? "Saving…" : "Save survey"}
          </button>
        </div>
      </div>
    </form>
  );
}
