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
    date: "रिपोर्ट की तारीख़ / Report date",
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
    onLeave: "इस दिन मैं छुट्टी पर था/थी",
    onLeaveHint: "छुट्टी दर्ज करने पर दैनिक रिपोर्ट भरने की ज़रूरत नहीं है।",
    submitLeave: "छुट्टी दर्ज करें / Mark leave",
    leaveDone: "छुट्टी दर्ज हो गई ✓",
    futureDate: "आने वाली तारीख़ की रिपोर्ट नहीं भर सकते।",
  },
  en: {
    date: "Report date",
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
    onLeave: "I was on leave this day",
    onLeaveHint: "Marking leave means no daily report is needed for this date.",
    submitLeave: "Mark leave",
    leaveDone: "Leave recorded ✓",
    futureDate: "Cannot submit a report for a future date.",
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
  const todayIso = new Date().toISOString().slice(0, 10);
  const [reportDate, setReportDate] = useState(todayIso);
  const [onLeave, setOnLeave] = useState(false);
  const [settlements, setSettlements] = useState<string[]>([]);
  const [workDone, setWorkDone] = useState("");
  const [completed, setCompleted] = useState("");
  const [issues, setIssues] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const toggle = (code: string) =>
    setSettlements((s) =>
      s.includes(code) ? s.filter((x) => x !== code) : [...s, code]
    );

  async function submit() {
    setErr(null);
    if (!reportDate || reportDate > todayIso) return setErr(t.futureDate);
    if (!onLeave) {
      if (settlements.length === 0) return setErr(t.needSettlement);
      if (!workDone.trim()) return setErr(t.required(t.work));
      const cw = wordCount(completed);
      if (cw < 50) return setErr(t.needWords(t.completed, cw));
      if (!issues.trim()) return setErr(t.required(t.issues));
      const tw = wordCount(tomorrow);
      if (tw < 50) return setErr(t.needWords(t.tomorrow, tw));
    }

    setBusy(true);
    try {
      await apiFetch("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          period: "daily",
          periodDate: reportDate,
          data: onLeave
            ? { on_leave: true }
            : {
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
        {onLeave ? t.leaveDone : t.done}
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
      {/* Report date — defaults to today; a past date can be picked to backfill. */}
      <div>
        <label className={labelClass}>
          {t.date} <span className="text-red-500">*</span>
        </label>
        <input
          type="date"
          className={inputClass}
          value={reportDate}
          max={todayIso}
          onChange={(e) => setReportDate(e.target.value)}
        />
      </div>

      {/* On leave — skips the daily report for the chosen date. */}
      <label className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/60 dark:bg-amber-950/30">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={onLeave}
          onChange={(e) => setOnLeave(e.target.checked)}
        />
        <span>
          <span className="block text-sm font-semibold text-amber-900 dark:text-amber-200">
            {t.onLeave}
          </span>
          <span className="block text-xs text-amber-700 dark:text-amber-300/80">
            {t.onLeaveHint}
          </span>
        </span>
      </label>

      {!onLeave && (
      <>
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
      </>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}
      <button className={`${btnPrimary} w-full`} onClick={submit} disabled={busy}>
        {busy ? t.saving : onLeave ? t.submitLeave : t.submit}
      </button>
    </div>
  );
}
