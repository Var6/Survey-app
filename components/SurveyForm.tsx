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
  type Section,
} from "@/lib/questionnaire";
import { inputClass, labelClass, btnPrimary, btnGhost } from "@/components/ui";
import { MOBILISER_CODES } from "@/lib/questionnaire/settlements";
import { enqueueSurvey } from "@/lib/outbox";

type Values = Record<string, unknown>;
type Rows = Record<string, Values[]>;

const REPEAT_CAP = 40;

function optLabel(o: Option): string {
  return o.hi && o.hi.trim() ? o.hi : o.en;
}

/** Strictly clean an integer input: digits only, clamped to max. */
function cleanInt(field: Field, raw: string): number | "" {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits === "") return "";
  let n = parseInt(digits, 10);
  const max = field.validation?.max;
  if (max !== undefined && n > max) n = max;
  return n;
}

function sectionHasVisibleItems(s: Section, values: Values): boolean {
  return s.items.some((it) =>
    isRepeat(it) ? evalCondition(it.showWhen, values) : isFieldVisible(it, values)
  );
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
  const [stepIndex, setStepIndex] = useState(0);

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
      () => setTopError("लोकेशन नहीं मिली — आप बिना इसके आगे बढ़ सकते हैं।")
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
    const required = isFieldRequired(field, ctx) && !(field.name === "mobiliser_code" && role === "director");
    const err = errors[keyPrefix + field.name];

    if (field.type === "note") {
      return (
        <div
          key={keyPrefix + field.name}
          className="rounded-lg bg-teal-50 px-3 py-2 text-sm leading-relaxed text-teal-900 dark:bg-teal-950/30 dark:text-teal-200"
        >
          {labelText(field.label)}
        </div>
      );
    }

    const label = (
      <label className={labelClass}>
        {labelText(field.label)}
        {required && <span className="text-red-500"> *</span>}
      </label>
    );

    let options = field.options;
    if (field.name === "settlement_name") {
      options = settlementOptions.map((s) => ({ code: s.code, en: s.label, hi: s.label }));
    }

    let control: React.ReactNode;

    if (field.name === "mobiliser_name") {
      // Director types any name; CM's name is fixed.
      control = (
        <input
          className={inputClass}
          value={(value as string) || ""}
          readOnly={role === "cm"}
          placeholder={role === "director" ? "कोई भी नाम लिखें" : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    } else if (field.name === "mobiliser_code" && role === "cm" && mobiliserCode) {
      control = <input className={inputClass} value={String(value || "")} readOnly />;
    } else if (field.type === "select" || field.name === "mobiliser_code") {
      const opts =
        field.name === "mobiliser_code" && (!options || options.length === 0)
          ? MOBILISER_CODES.map((c) => ({ code: c, en: c, hi: c }))
          : options || [];
      control = (
        <select
          className={inputClass}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">— चुनें —</option>
          {opts.map((op) => (
            <option key={op.code} value={op.code}>
              {optLabel(op)}
            </option>
          ))}
        </select>
      );
    } else if (field.type === "multiselect") {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {(options || []).map((op) => (
            <label
              key={op.code}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
            >
              <input
                type="checkbox"
                checked={arr.includes(op.code)}
                onChange={() =>
                  onChange(
                    arr.includes(op.code)
                      ? arr.filter((x) => x !== op.code)
                      : [...arr, op.code]
                  )
                }
              />
              <span className="text-zinc-700 dark:text-zinc-300">{optLabel(op)}</span>
            </label>
          ))}
        </div>
      );
    } else if (field.type === "textarea") {
      control = (
        <textarea
          className={inputClass}
          rows={2}
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    } else if (field.type === "geopoint") {
      const g = value as { lat: number; lng: number } | null;
      control = (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={btnGhost}
            onClick={() => captureGps(field.name)}
          >
            📍 लोकेशन लें
          </button>
          {g && (
            <span className="text-xs text-zinc-500">
              {g.lat.toFixed(5)}, {g.lng.toFixed(5)}
            </span>
          )}
        </div>
      );
    } else if (field.type === "integer" || field.type === "decimal") {
      // Strict numeric: only digits can be entered.
      const strVal =
        value === "" || value === undefined || value === null ? "" : String(value);
      control = (
        <input
          className={inputClass}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={strVal}
          onChange={(e) => onChange(cleanInt(field, e.target.value))}
        />
      );
    } else if (field.type === "phone") {
      control = (
        <input
          className={inputClass}
          type="tel"
          inputMode="tel"
          value={(value as string) || ""}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
        />
      );
    } else {
      const type = field.type === "date" ? "date" : field.type === "time" ? "time" : "text";
      control = (
        <input
          className={inputClass}
          type={type}
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    }

    return (
      <div key={keyPrefix + field.name}>
        {label}
        {control}
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
          ऊपर गिनती भरें ताकि यहाँ प्रविष्टियाँ जुड़ें।
        </p>
      );
    }
    return (
      <div key={group.name} className="space-y-3">
        {Array.from({ length: count }).map((_, i) => {
          const row = (rows[group.name] || [])[i] || {};
          const ctx = { ...values, ...row };
          return (
            <div
              key={i}
              className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
            >
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

  /* ── Validation ─────────────────────────────────────────── */
  function computeErrors(sections: Section[]): Record<string, string> {
    const errs: Record<string, string> = {};
    for (const section of sections) {
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
          if (item.name === "mobiliser_code" && role === "director") continue;
          const msg = validateField(item, values[item.name], values);
          if (msg) errs[item.name] = msg;
        }
      }
    }
    return errs;
  }

  /* ── Steps (visible sections, recomputed from answers) ──── */
  const visibleSections = useMemo(
    () =>
      QUESTIONNAIRE.filter(
        (s) => evalCondition(s.showWhen, values) && sectionHasVisibleItems(s, values)
      ),
    [values]
  );
  const clampedIndex = Math.min(stepIndex, visibleSections.length - 1);
  const section = visibleSections[clampedIndex];
  const isLast = clampedIndex >= visibleSections.length - 1;

  function goNext() {
    const e = computeErrors([section]);
    setErrors(e);
    if (Object.keys(e).length) {
      setTopError("कृपया लाल निशान वाले सवाल पूरे करें।");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setTopError(null);
    if (isLast) {
      submit();
    } else {
      setStepIndex(clampedIndex + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function goBack() {
    setTopError(null);
    setStepIndex(Math.max(0, clampedIndex - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit() {
    setTopError(null);
    if (role === "director" && !projectId) {
      setStepIndex(0);
      setTopError("कृपया प्रोजेक्ट चुनें।");
      return;
    }
    const e = computeErrors(visibleSections);
    setErrors(e);
    if (Object.keys(e).length) {
      const idx = visibleSections.findIndex(
        (s) => Object.keys(computeErrors([s])).length > 0
      );
      if (idx >= 0) setStepIndex(idx);
      setTopError("कृपया लाल निशान वाले सवाल पूरे करें।");
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const countOf = (n: string) => Math.min(Number(values[n]) || 0, REPEAT_CAP);
    const slice = (name: string, n: string) =>
      Array.from({ length: countOf(n) }, (_, i) => (rows[name] || [])[i] || {});

    const payload = {
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
    };
    const label =
      (values.head_name as string) || (values.respondent_name as string) || "Household";
    const home = role === "director" ? "/director/surveys" : "/cm/surveys";

    if (role === "cm" && typeof navigator !== "undefined" && !navigator.onLine) {
      enqueueSurvey(payload, label);
      router.replace(home);
      router.refresh();
      return;
    }

    setSubmitting(true);
    try {
      await apiFetch("/api/surveys", { method: "POST", body: JSON.stringify(payload) });
      router.replace(home);
      router.refresh();
    } catch (err) {
      if (role === "cm" && err instanceof TypeError) {
        enqueueSurvey(payload, label);
        router.replace(home);
        router.refresh();
      } else {
        setTopError((err as Error).message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!section) return null;
  const progress = Math.round(((clampedIndex + 1) / visibleSections.length) * 100);

  return (
    <div className="pb-24">
      {/* Progress */}
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
          <span>
            खंड {clampedIndex + 1} / {visibleSections.length}
          </span>
          <span className="rounded bg-teal-100 px-1.5 py-0.5 font-semibold text-teal-800 dark:bg-teal-900/40 dark:text-teal-300">
            {section.id}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div className="h-full bg-teal-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
        <h2 className="mt-2 text-base font-bold text-zinc-900 dark:text-zinc-50">
          {labelText(section.title)}
        </h2>
      </div>

      {topError && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {topError}
        </p>
      )}

      <div className="space-y-4">
        {clampedIndex === 0 && role === "director" && (
          <div>
            <label className={labelClass}>
              प्रोजेक्ट <span className="text-red-500">*</span>
            </label>
            <select
              className={inputClass}
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">— प्रोजेक्ट चुनें —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {section.items.map((item) =>
          isRepeat(item)
            ? renderRepeat(item)
            : isFieldVisible(item, values)
            ? renderField(item, values, values[item.name], (v) => setValue(item.name, v), "")
            : null
        )}
      </div>

      {/* Nav bar */}
      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-black/90">
        <div className="mx-auto flex max-w-3xl gap-2">
          {clampedIndex > 0 && (
            <button type="button" onClick={goBack} className={`${btnGhost} flex-1`}>
              ← पीछे
            </button>
          )}
          <button
            type="button"
            onClick={goNext}
            disabled={submitting}
            className={`${btnPrimary} flex-[2]`}
          >
            {submitting ? "सेव हो रहा है…" : isLast ? "सर्वे सेव करें" : "आगे →"}
          </button>
        </div>
      </div>
    </div>
  );
}
