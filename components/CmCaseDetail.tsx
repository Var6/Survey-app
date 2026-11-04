"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { uploadImage } from "@/lib/image";
import { MODULES } from "@/lib/cases/modules";
import { presetTypesForCase } from "@/lib/support/schema";
import SupportForm, { emptySupport } from "./SupportForm";
import { CM_CAN_FOLLOW_UP, CM_CAN_REQUEST_CLOSURE } from "@/lib/cases/workflow";
import {
  CaseItem,
  ClosureItem,
  ClosureList,
  Field,
  FollowupItem,
  FollowupList,
  PriorityPill,
  WorkflowPill,
  inputCls,
} from "./case-ui";

const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
const newKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** CM's page for one case: record a follow-up, then ask for closure. */
export default function CmCaseDetail({ caseId }: { caseId: string }) {
  const [item, setItem] = useState<CaseItem | null>(null);
  const [followups, setFollowups] = useState<FollowupItem[]>([]);
  const [closures, setClosures] = useState<ClosureItem[]>([]);
  const [policyText, setPolicyText] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await apiFetch<{
        case: CaseItem;
        followups: FollowupItem[];
        closures: ClosureItem[];
        policy: { text: string };
      }>(`/api/cases/${caseId}`);
      setItem(r.case);
      setFollowups(r.followups);
      setClosures(r.closures);
      setPolicyText(r.policy.text);
      setErr(null);
    } catch (e) {
      const m = (e as Error).message;
      if (/not found/i.test(m)) setNotFound(true);
      else setErr(m);
    }
  }, [caseId]);
  useEffect(() => {
    load();
  }, [load]);

  if (notFound) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p className="text-sm text-zinc-500">यह केस नहीं मिला · Case not found.</p>
        <Link href="/cm/cases" className="mt-2 inline-block text-sm font-medium text-teal-600 underline">
          ← मेरे केस · My cases
        </Link>
      </div>
    );
  }
  if (!item) return <p className="text-sm text-zinc-400">{err ?? "Loading…"}</p>;

  const status = item.workflowStatus;
  const canFollowUp = !item.closed && (CM_CAN_FOLLOW_UP as string[]).includes(status);
  const canRequest = !item.closed && (CM_CAN_REQUEST_CLOSURE as string[]).includes(status);
  const lastRejection = closures.find((c) => c.status === "rejected");
  const rejectReasons = lastRejection?.decisions.filter((d) => d.decision === "reject") ?? [];
  const def = MODULES[item.module];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/cm/cases" className="text-xs font-medium text-teal-600 hover:underline">
          ← मेरे केस · My cases
        </Link>
        <p className="mt-2 font-mono text-xs text-zinc-400">
          {item.caseId} · {def.short}
        </p>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
          {item.subjectName || item.title}
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {item.subcategoryLabel} · {item.householdId} · {item.settlementLabel}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <WorkflowPill status={status} />
          <PriorityPill priority={item.priority} />
          {item.dueDate && (
            <span className="text-xs text-zinc-500">तारीख़ · Due {formatDate(item.dueDate)}</span>
          )}
        </div>
      </div>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
      {flash && <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">{flash}</p>}

      {status === "revision_required" && rejectReasons.length > 0 && (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/20">
          <p className="text-sm font-bold text-red-800 dark:text-red-300">
            बंद करने का अनुरोध वापस आया · Closure sent back
          </p>
          {rejectReasons.map((d) => (
            <p key={d.userId} className="mt-1 text-sm text-red-900 dark:text-red-200">
              <span className="font-semibold">{d.name}:</span> {d.reason}
            </p>
          ))}
          <p className="mt-2 text-xs text-red-700 dark:text-red-300">
            नया फॉलो-अप दर्ज करें, फिर दोबारा अनुरोध करें · Record a new follow-up, then ask again.
          </p>
        </div>
      )}

      {(status === "closure_requested" || status === "under_review") && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-900/60 dark:bg-amber-950/20">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
            जाँच चल रही है · Waiting for review
          </p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">{policyText}</p>
        </div>
      )}

      {status === "verified_closed" && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-300">
          ✓ केस की जाँच हो चुकी और बंद है · Verified and closed
        </div>
      )}

      {canFollowUp && (
        <FollowupForm
          caseId={item.id}
          onDone={(msg) => {
            setFlash(msg);
            load();
          }}
        />
      )}

      {(canFollowUp || canRequest) && !item.closed && (
        <CloseCaseButton
          item={item}
          policyText={policyText}
          onDone={(msg) => {
            setFlash(msg);
            load();
          }}
        />
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-800 dark:text-zinc-100">
          फॉलो-अप का इतिहास · Follow-up history ({followups.length})
        </h2>
        <FollowupList followups={followups} />
      </section>

      {closures.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold text-zinc-800 dark:text-zinc-100">
            बंद करने के अनुरोध · Closure requests
          </h2>
          <ClosureList closures={closures} />
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold text-zinc-800 dark:text-zinc-100">Activity</h2>
        <ul className="space-y-1.5">
          {[...item.history].reverse().map((h, i) => (
            <li key={i} className="text-xs">
              <span className="text-zinc-700 dark:text-zinc-200">{h.note}</span>
              <span className="text-zinc-400"> · {formatDate(h.at)}{h.by ? ` · ${h.by}` : ""}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function FollowupForm({ caseId, onDone }: { caseId: string; onDone: (msg: string) => void }) {
  const [followupDate, setDate] = useState(today());
  const [observations, setObs] = useState("");
  const [actionsTaken, setActions] = useState("");
  const [remarks, setRemarks] = useState("");
  const [attachments, setAttachments] = useState<{ key: string; url: string; name?: string }[]>([]);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [busy, setBusy] = useState<"" | "draft" | "submit" | "upload">("");
  const [err, setErr] = useState<string | null>(null);
  const clientKey = useRef(newKey());
  const fileRef = useRef<HTMLInputElement>(null);

  // Pick up a saved draft so work is never lost.
  useEffect(() => {
    apiFetch<{ followups: (FollowupItem & { status: string })[] }>(`/api/cases/${caseId}/followups`)
      .then((r) => {
        const d = r.followups.find((f) => f.status === "draft");
        if (d) {
          setDraftId(d.id);
          setDate(d.followupDate);
          setObs(d.observations);
          setActions(d.actionsTaken);
          setRemarks(d.remarks ?? "");
          setAttachments(d.attachments);
        }
      })
      .catch(() => {});
  }, [caseId]);

  const onFile = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy("upload");
    setErr(null);
    try {
      const added: { key: string; url: string; name?: string }[] = [];
      for (const f of Array.from(files).slice(0, 6 - attachments.length)) {
        const r = await uploadImage(f, "uploads");
        added.push({ key: r.key, url: r.url, name: f.name });
      }
      setAttachments((p) => [...p, ...added].slice(0, 6));
    } catch (e) {
      setErr(`फोटो अपलोड नहीं हुई · Photo upload failed: ${(e as Error).message}`);
    } finally {
      setBusy("");
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const send = async (draft: boolean) => {
    setBusy(draft ? "draft" : "submit");
    setErr(null);
    try {
      const r = await apiFetch<{ followup: { id: string }; duplicate: boolean }>(
        `/api/cases/${caseId}/followups`,
        {
          method: "POST",
          body: JSON.stringify({
            followupDate, observations, actionsTaken, remarks, attachments,
            draft, followupId: draftId ?? undefined, clientKey: clientKey.current,
          }),
        }
      );
      if (draft) {
        setDraftId(r.followup.id);
        onDone("ड्राफ़्ट सेव हुआ · Draft saved");
      } else {
        clientKey.current = newKey();
        setDraftId(null);
        setObs(""); setActions(""); setRemarks(""); setAttachments([]);
        onDone("फॉलो-अप जमा हुआ। MIS और PM को सूचना भेज दी गई · Follow-up submitted. MIS and PM have been notified.");
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100">
        नया फॉलो-अप · Record a follow-up {draftId && <span className="text-xs font-normal text-amber-600">(ड्राफ़्ट · draft)</span>}
      </h2>
      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{err}</p>}
      <Field label="फॉलो-अप की तारीख़ · Date of follow-up *">
        <input type="date" className={inputCls} value={followupDate} max={today()} onChange={(e) => setDate(e.target.value)} />
      </Field>
      <Field label="क्या देखा · What you observed *">
        <textarea className={inputCls} rows={3} value={observations} onChange={(e) => setObs(e.target.value)} maxLength={4000} />
      </Field>
      <Field label="क्या कदम उठाया · Action taken *">
        <textarea className={inputCls} rows={3} value={actionsTaken} onChange={(e) => setActions(e.target.value)} maxLength={4000} />
      </Field>
      <Field label="टिप्पणी · Remarks">
        <textarea className={inputCls} rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} maxLength={2000} />
      </Field>
      <div>
        <span className="mb-1 block text-xs font-medium text-zinc-500">फोटो / सबूत · Photo or evidence (up to 6)</span>
        <div className="flex flex-wrap items-center gap-2">
          {attachments.map((a) => (
            <span key={a.key} className="relative h-16 w-16 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={a.url} alt={a.name || "Evidence"} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setAttachments((p) => p.filter((x) => x.key !== a.key))}
                className="absolute right-0 top-0 rounded-bl bg-black/60 px-1 text-xs text-white"
                aria-label="Remove photo"
              >
                ×
              </button>
            </span>
          ))}
          {attachments.length < 6 && (
            <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-300 text-2xl text-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900">
              {busy === "upload" ? "…" : "+"}
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFile(e.target.files)} />
            </label>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          onClick={() => send(false)}
          disabled={busy !== ""}
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {busy === "submit" ? "जमा हो रहा है…" : "जमा करें · Submit follow-up"}
        </button>
        <button
          type="button"
          onClick={() => send(true)}
          disabled={busy !== ""}
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          {busy === "draft" ? "…" : "ड्राफ़्ट सेव · Save draft"}
        </button>
      </div>
    </section>
  );
}

/**
 * "Close case" opens the Community Support & Follow-up form for this case.
 * Choosing Complete sends it to MIS, the Programme Manager and the Director to
 * verify (the case closes only after they approve); Follow-up required saves it
 * as a follow-up and the case stays open.
 */
function CloseCaseButton({ item, policyText, onDone }: { item: CaseItem; policyText: string; onDone: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const today = new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const docs = (item.meta?.docs as unknown) ?? undefined;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border border-teal-600 bg-teal-700 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-800"
      >
        केस बंद करें / सहायता फ़ॉर्म भरें · Close case — fill the support form
      </button>
      <p className="-mt-3 text-center text-[11px] text-zinc-400">{policyText}</p>
      {open && (
        <SupportForm
          hi
          caseId={item.id}
          lock={{ community: true, referral: true, beneficiary: true }}
          initial={{
            ...emptySupport(today),
            settlementCode: item.settlementCode,
            referral: item.module,
            beneficiaryName: item.subjectName ?? "",
            supportTypes: presetTypesForCase(item.module, item.subcategory, docs),
          }}
          onClose={() => setOpen(false)}
          onSaved={(r) => {
            setOpen(false);
            onDone(
              r.verification === "pending"
                ? "फ़ॉर्म जमा हुआ। केस बंद करने का अनुरोध MIS, PM और Director को भेजा गया · Form submitted. The closure request has gone to MIS, the Programme Manager and the Director."
                : "फॉलो-अप दर्ज हुआ; केस खुला है · Follow-up recorded; the case stays open."
            );
          }}
        />
      )}
    </>
  );
}
