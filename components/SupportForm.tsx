"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/client";
import { useSettlements } from "@/lib/useSettlements";
import { REFERRALS, STATUSES, detailFields, supportTypesFor } from "@/lib/support/schema";
import { Field, inputCls } from "./case-ui";

export interface SupportFormValues {
  supportDate: string;
  settlementCode: string;
  referral: string;
  beneficiaryName: string;
  phone: string;
  supportTypes: string[];
  details: Record<string, string>;
  photoLinks: string;
  status: "" | "complete" | "follow_up_required";
  remarks: string;
}

export const emptySupport = (today: string): SupportFormValues => ({
  supportDate: today, settlementCode: "", referral: "", beneficiaryName: "", phone: "",
  supportTypes: [], details: {}, photoLinks: "", status: "", remarks: "",
});

const STEPS = [
  { en: "Who and where", hi: "कौन और कहाँ" },
  { en: "Support given", hi: "क्या सहायता दी" },
  { en: "Proof and status", hi: "सबूत और स्थिति" },
] as const;

/**
 * Community Support & Follow-up — a three-page form. Page 2 changes with the
 * referral chosen on page 1 (documents ask which certificates; health asks
 * about the facility; education about the school …).
 *
 * `lock` fixes the community / referral / beneficiary when the form is opened
 * from a case, so the CM cannot attach support to the wrong person.
 */
export default function SupportForm({
  initial,
  lock,
  caseId,
  hi,
  submitLabel,
  editId,
  onClose,
  onSaved,
}: {
  initial: SupportFormValues;
  lock?: { community?: boolean; referral?: boolean; beneficiary?: boolean };
  caseId?: string;
  hi: boolean;
  submitLabel?: string;
  /** Editing an existing record (office roles). */
  editId?: string;
  onClose: () => void;
  onSaved: (result: { id: string; status: string; verification: string }) => void;
}) {
  const { settlements } = useSettlements(true);
  const [v, setV] = useState<SupportFormValues>(initial);
  const [step, setStep] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

  const set = <K extends keyof SupportFormValues>(k: K, val: SupportFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const types = useMemo(() => supportTypesFor(v.referral), [v.referral]);
  const fields = useMemo(() => detailFields(v.referral), [v.referral]);
  const T = (en: string, h: string) => (hi ? `${h} · ${en}` : en);

  const check = (s: number): string | null => {
    if (s === 0) {
      if (!v.supportDate) return T("Choose the date", "तारीख़ चुनें");
      if (!v.settlementCode) return T("Choose the community", "समुदाय चुनें");
      if (!v.referral) return T("Choose the referral", "रेफ़रल चुनें");
      if (v.beneficiaryName.trim().length < 2) return T("Write the beneficiary's name", "लाभार्थी का नाम लिखें");
      if (v.phone.trim() && !/^\d{10}$/.test(v.phone.replace(/\D/g, ""))) return T("Phone number must be 10 digits", "फ़ोन नंबर 10 अंकों का हो");
    }
    if (s === 1 && v.supportTypes.length === 0) return T("Choose the type of support", "सहायता का प्रकार चुनें");
    if (s === 2 && !v.status) return T("Choose the status", "स्थिति चुनें");
    return null;
  };
  const next = () => {
    const e = check(step);
    setErr(e);
    if (!e) setStep(step + 1);
  };
  const submit = async () => {
    for (let s = 0; s <= 2; s++) {
      const e = check(s);
      if (e) { setErr(e); setStep(s); return; }
    }
    setBusy(true);
    setErr(null);
    try {
      const r = await apiFetch<{ record: { id: string; status: string; verification: string } }>(
        editId ? `/api/support-records/${editId}` : "/api/support-records",
        { method: editId ? "PATCH" : "POST", body: JSON.stringify({ ...v, ...(caseId ? { caseId } : {}) }) }
      );
      onSaved(r.record);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggleType = (k: string) =>
    set("supportTypes", v.supportTypes.includes(k) ? v.supportTypes.filter((x) => x !== k) : [...v.supportTypes, k]);

  return (
    <div className="fixed inset-0 z-50 print:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col bg-white shadow-xl dark:bg-zinc-950">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
              {editId ? "Edit support record" : caseId ? T("Close case — support & follow-up", "केस बंद करें — सहायता और फॉलो-अप") : T("Community support & follow-up", "सामुदायिक सहायता और फॉलो-अप")}
            </h2>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg px-2 py-1 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900">✕</button>
          </div>
          <ol className="mt-3 flex gap-2" aria-label="Form pages">
            {STEPS.map((s, i) => (
              <li key={s.en} className={`flex-1 rounded-lg px-2 py-1.5 text-center text-xs font-medium ${i === step ? "bg-teal-700 text-white" : i < step ? "bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-900"}`}>
                {i + 1}. {hi ? s.hi : s.en}
              </li>
            ))}
          </ol>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
          {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{err}</p>}

          {step === 0 && (
            <>
              <Field label={T("Date *", "तारीख़ *")}><input type="date" className={inputCls} value={v.supportDate} max={today} onChange={(e) => set("supportDate", e.target.value)} /></Field>
              <Field label={T("Community name *", "समुदाय का नाम *")}>
                <select className={inputCls} value={v.settlementCode} disabled={lock?.community} onChange={(e) => set("settlementCode", e.target.value)}>
                  <option value="">Choose…</option>
                  {settlements.map((s) => <option key={s.code} value={s.code}>{s.label}</option>)}
                </select>
              </Field>
              <Field label={T("Referral *", "रेफ़रल *")}>
                <select className={inputCls} value={v.referral} disabled={lock?.referral} onChange={(e) => setV((p) => ({ ...p, referral: e.target.value, supportTypes: [], details: {} }))}>
                  <option value="">Choose…</option>
                  {REFERRALS.map((r) => <option key={r.key} value={r.key}>{hi ? `${r.hi} · ${r.label}` : r.label}</option>)}
                </select>
              </Field>
              <Field label={T("Name of beneficiary *", "लाभार्थी का नाम *")}><input className={inputCls} value={v.beneficiaryName} readOnly={lock?.beneficiary} onChange={(e) => set("beneficiaryName", e.target.value)} maxLength={120} /></Field>
              <Field label={T("Phone number", "फ़ोन नंबर")}><input inputMode="numeric" className={inputCls} value={v.phone} onChange={(e) => set("phone", e.target.value)} maxLength={14} placeholder="10 digits" /></Field>
            </>
          )}

          {step === 1 && (
            <>
              <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">{REFERRALS.find((r) => r.key === v.referral)?.[hi ? "hi" : "label"]}</p>
              <fieldset>
                <legend className="mb-1 text-xs font-medium text-zinc-500">{T("Type of support * (tick all that apply)", "सहायता का प्रकार * (जो लागू हों सब चुनें)")}</legend>
                <div className="grid gap-1.5 sm:grid-cols-2">
                  {types.map((t) => (
                    <label key={t.key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${v.supportTypes.includes(t.key) ? "border-teal-600 bg-teal-50 dark:bg-teal-950/30" : "border-zinc-200 dark:border-zinc-800"}`}>
                      <input type="checkbox" checked={v.supportTypes.includes(t.key)} onChange={() => toggleType(t.key)} />
                      {t.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {fields.map((f) => (
                <Field key={f.key} label={f.label}>
                  {f.type === "yesno" ? (
                    <select className={inputCls} value={v.details[f.key] ?? ""} onChange={(e) => set("details", { ...v.details, [f.key]: e.target.value })}>
                      <option value="">—</option><option value="yes">Yes</option><option value="no">No</option>
                    </select>
                  ) : (
                    <input type={f.type === "date" ? "date" : "text"} className={inputCls} value={v.details[f.key] ?? ""} max={f.type === "date" ? undefined : undefined} onChange={(e) => set("details", { ...v.details, [f.key]: e.target.value })} maxLength={300} />
                  )}
                </Field>
              ))}
            </>
          )}

          {step === 2 && (
            <>
              <Field label={T("Photo / proof — Google Drive link(s)", "फ़ोटो / सबूत — Google Drive लिंक")}>
                <textarea className={inputCls} rows={3} value={v.photoLinks} onChange={(e) => set("photoLinks", e.target.value)} placeholder="https://drive.google.com/…  (one per line)" />
              </Field>
              <p className="-mt-2 text-xs text-zinc-400">{hi ? "Drive में फ़ाइल डालकर ‘Anyone with the link’ करें और लिंक चिपकाएँ। · " : ""}Only Google Drive / Photos links are accepted.</p>
              <fieldset>
                <legend className="mb-1 text-xs font-medium text-zinc-500">{T("Status *", "स्थिति *")}</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {STATUSES.map((s) => (
                    <label key={s.key} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-3 text-sm font-medium ${v.status === s.key ? (s.key === "complete" ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "border-amber-500 bg-amber-50 dark:bg-amber-950/30") : "border-zinc-200 dark:border-zinc-800"}`}>
                      <input type="radio" name="status" checked={v.status === s.key} onChange={() => set("status", s.key)} />
                      {hi ? `${s.hi} · ${s.label}` : s.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              {caseId && v.status === "complete" && (
                <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                  {hi ? "‘पूरा’ चुनने पर केस बंद करने का अनुरोध MIS, PM और Director को जाँच के लिए जाएगा — केस उनकी मंज़ूरी के बाद ही बंद होगा। · " : ""}
                  Choosing Complete sends a closure request to MIS, the Programme Manager and the Director. The case closes only after they verify it.
                </p>
              )}
              {caseId && v.status === "follow_up_required" && (
                <p className="rounded-lg bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                  {hi ? "यह फॉलो-अप के रूप में दर्ज होगा; केस खुला रहेगा। · " : ""}This is saved as a follow-up; the case stays open.
                </p>
              )}
              <Field label={T("Remarks", "टिप्पणी")}><textarea className={inputCls} rows={3} value={v.remarks} onChange={(e) => set("remarks", e.target.value)} maxLength={3000} /></Field>
            </>
          )}
        </div>

        <div className="flex gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          {step > 0 && <button type="button" onClick={() => { setErr(null); setStep(step - 1); }} className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium dark:border-zinc-700">← {hi ? "पीछे · Back" : "Back"}</button>}
          {step < 2 ? (
            <button type="button" onClick={next} className="ml-auto rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800">{hi ? "आगे · Next" : "Next"} →</button>
          ) : (
            <button type="button" onClick={submit} disabled={busy} className="ml-auto rounded-lg bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60">
              {busy ? "…" : submitLabel ?? (editId ? "Save changes" : hi ? "जमा करें · Submit" : "Submit")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
