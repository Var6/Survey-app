"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/client";
import { SETTLEMENTS } from "@/lib/questionnaire/settlements";
import { inputClass, labelClass, btnPrimary } from "@/components/ui";

/**
 * Revised daily update (PMD spec) — auto header + only four fields.
 * lang="hi" (Community Mobiliser) shows Hindi-first labels; "en" (Programme
 * Manager) shows English.
 */

const L = {
  hi: {
    where: "आज आपने कहाँ काम किया? / Where did you work today?",
    work: "आपने व्यक्तिगत रूप से क्या किया? / What did you personally do?",
    completed: "आज क्या कार्य पूरे हुए? (अधिकतम 3 उपलब्धियाँ, कम से कम 50 शब्द)",
    issues: "किस महत्वपूर्ण मुद्दे, विलंब या जोखिम पर ध्यान देने की आवश्यकता है?",
    tomorrow: "कल के लिए आपकी प्राथमिकता वाली कार्ययोजनाएँ क्या हैं? (1–3 कार्य, कम से कम 50 शब्द)",
    submit: "रिपोर्ट जमा करें / Submit report",
    saving: "जमा हो रहा है…",
    needSettlement: "कम से कम एक बस्ती चुनें।",
    needWords: (label: string, n: number) =>
      `"${label}" में कम से कम 50 शब्द लिखें (अभी ${n} शब्द)।`,
    required: (label: string) => `"${label}" ज़रूरी है।`,
    done: "रिपोर्ट जमा हो गई ✓",
    words: "शब्द",
  },
  en: {
    where: "Where did you work today?",
    work: "What did you personally do?",
    completed: "What was completed today? (up to 3 achievements, min. 50 words)",
    issues: "What important issue, delay or risk needs attention?",
    tomorrow: "What are your priority actions for tomorrow? (1–3 actions, min. 50 words)",
    submit: "Submit report",
    saving: "Submitting…",
    needSettlement: "Select at least one settlement.",
    needWords: (label: string, n: number) =>
      `"${label}" needs at least 50 words (currently ${n}).`,
    required: (label: string) => `"${label}" is required.`,
    done: "Report submitted ✓",
    words: "words",
  },
};

const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export default function DailyUpdateForm({
  lang,
  onDone,
}: {
  lang: "hi" | "en";
  onDone?: () => void;
}) {
  const t = L[lang];
  const [settlements, setSettlements] = useState<string[]>([]);
  const [workDone, setWorkDone] = useState("");
  const [completed, setCompleted] = useState("");
  const [issues, setIssues] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const today = new Date().toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const toggle = (code: string) =>
    setSettlements((s) =>
      s.includes(code) ? s.filter((x) => x !== code) : [...s, code]
    );

  async function submit() {
    setErr(null);
    if (settlements.length === 0) return setErr(t.needSettlement);
    if (!workDone.trim()) return setErr(t.required(t.work));
    const cw = wordCount(completed);
    if (cw < 50) return setErr(t.needWords(t.completed, cw));
    if (!issues.trim()) return setErr(t.required(t.issues));
    const tw = wordCount(tomorrow);
    if (tw < 50) return setErr(t.needWords(t.tomorrow, tw));

    setBusy(true);
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          period: "daily",
          periodDate: new Date().toISOString().slice(0, 10),
          data: {
            settlements_worked: settlements,
            work_done: workDone.trim(),
            completed_today: completed.trim(),
            issues_risks: issues.trim(),
            tomorrow_priorities: tomorrow.trim(),
          },
        }),
      });
      setOk(true);
      onDone?.();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (ok) {
    return (
      <p className="rounded-xl bg-teal-50 px-4 py-6 text-center text-sm font-semibold text-teal-800 dark:bg-teal-950/30 dark:text-teal-300">
        {t.done}
      </p>
    );
  }

  const wordsHint = (text: string) => (
    <p className="mt-0.5 text-right text-[11px] tabular-nums text-zinc-400">
      {wordCount(text)} {t.words} / 50
    </p>
  );

  return (
    <div className="space-y-4">
      {/* Auto header */}
      <div className="rounded-lg bg-zinc-100 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        {today} · {lang === "hi" ? "स्थिति: ड्राफ्ट" : "Status: draft"}
      </div>

      <div>
        <label className={labelClass}>
          {t.where} <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          {SETTLEMENTS.map((s) => (
            <label
              key={s.code}
              className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800"
            >
              <input
                type="checkbox"
                checked={settlements.includes(s.code)}
                onChange={() => toggle(s.code)}
              />
              <span className="text-zinc-700 dark:text-zinc-300">{s.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={labelClass}>
          {t.work} <span className="text-red-500">*</span>
        </label>
        <textarea
          className={inputClass}
          rows={3}
          value={workDone}
          onChange={(e) => setWorkDone(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>
          {t.completed} <span className="text-red-500">*</span>
        </label>
        <textarea
          className={inputClass}
          rows={4}
          value={completed}
          onChange={(e) => setCompleted(e.target.value)}
        />
        {wordsHint(completed)}
      </div>

      <div>
        <label className={labelClass}>
          {t.issues} <span className="text-red-500">*</span>
        </label>
        <textarea
          className={inputClass}
          rows={3}
          value={issues}
          onChange={(e) => setIssues(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>
          {t.tomorrow} <span className="text-red-500">*</span>
        </label>
        <textarea
          className={inputClass}
          rows={4}
          value={tomorrow}
          onChange={(e) => setTomorrow(e.target.value)}
        />
        {wordsHint(tomorrow)}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className={`${btnPrimary} w-full`} onClick={submit} disabled={busy}>
        {busy ? t.saving : t.submit}
      </button>
    </div>
  );
}
