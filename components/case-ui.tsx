"use client";

import { formatDate } from "@/lib/client";
import type { CaseModule, CasePriority } from "@/lib/cases/modules";
import { WORKFLOW_LABEL, WORKFLOW, WORKFLOW_TONE } from "@/lib/cases/workflow";

/* Shapes returned by /api/cases (see publicCase / publicFollowup / publicClosure). */
export interface HistoryItem {
  at: string;
  stage: string | null;
  stageLabel: string | null;
  note: string | null;
  by: string | null;
}
export interface CaseItem {
  id: string;
  caseId: string;
  module: CaseModule;
  moduleTitle: string;
  subcategory: string;
  subcategoryLabel: string;
  title: string;
  subjectName: string | null;
  priority: CasePriority;
  stage: string;
  stageLabel: string;
  closed: boolean;
  householdId: string;
  settlementCode: string;
  settlementLabel: string;
  assignedCmId: string | null;
  assignedCmName: string | null;
  workflowStatus: string;
  workflowLabel: string;
  segment: string | null;
  segmentLabel: string | null;
  followupCount: number;
  lastFollowupAt: string | null;
  closureRequestId: string | null;
  assignee: string | null;
  dueDate: string | null;
  meta: Record<string, unknown>;
  fields: Record<string, unknown>;
  history: HistoryItem[];
  createdAt: string;
}
export interface FollowupItem {
  id: string;
  cmName: string;
  followupDate: string;
  observations: string;
  actionsTaken: string;
  remarks: string | null;
  attachments: { key: string; url: string; name?: string }[];
  status: "draft" | "submitted";
  submittedAt: string | null;
  createdAt: string;
}
export interface ClosureItem {
  id: string;
  requestedByName: string;
  requestedAt: string;
  note: string | null;
  status: "pending" | "under_review" | "approved" | "rejected" | "superseded";
  policy: { mode: string; requiredRoles: string[]; text: string };
  decisions: {
    userId: string;
    name: string;
    role: string;
    decision: "approve" | "reject";
    reason: string | null;
    at: string;
  }[];
  resolvedAt: string | null;
}

export const PRIORITY_STYLE: Record<CasePriority, string> = {
  urgent: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400",
  high: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  medium: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-400",
  low: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
};

export const ROLE_LABEL: Record<string, string> = {
  director: "Director",
  mis: "MIS",
  programme_manager: "Programme Manager",
  cm: "Community Mobiliser",
};

export function WorkflowPill({ status }: { status: string }) {
  const tone = WORKFLOW.find((w) => w.key === status)?.tone ?? "zinc";
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${WORKFLOW_TONE[tone]}`}
    >
      {WORKFLOW_LABEL[status] ?? status}
    </span>
  );
}

export function PriorityPill({ priority }: { priority: CasePriority }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${PRIORITY_STYLE[priority]}`}
    >
      {priority}
    </span>
  );
}

export const inputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Follow-up history — each entry is a separate, dated record. */
export function FollowupList({ followups }: { followups: FollowupItem[] }) {
  if (!followups.length) {
    return <p className="text-sm text-zinc-400">No follow-up recorded yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {followups.map((f) => (
        <li
          key={f.id}
          className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
        >
          <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-zinc-500">
            <span className="font-semibold text-zinc-700 dark:text-zinc-200">
              {formatDate(f.followupDate)} · {f.cmName}
            </span>
            {f.submittedAt && <span>Submitted {formatDate(f.submittedAt)}</span>}
          </div>
          <p className="mt-2 text-xs font-medium text-zinc-500">Observed</p>
          <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{f.observations}</p>
          <p className="mt-2 text-xs font-medium text-zinc-500">Action taken</p>
          <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{f.actionsTaken}</p>
          {f.remarks && (
            <>
              <p className="mt-2 text-xs font-medium text-zinc-500">Remarks</p>
              <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-100">{f.remarks}</p>
            </>
          )}
          {f.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {f.attachments.map((a) => (
                <a
                  key={a.key}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block h-16 w-16 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-700"
                  title={a.name || "Evidence"}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={a.url} alt={a.name || "Evidence"} className="h-full w-full object-cover" />
                </a>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

const DECISION_STYLE = {
  approve: "text-emerald-700 dark:text-emerald-400",
  reject: "text-red-700 dark:text-red-400",
};

/** Closure request(s): who asked, the approval rule, and each reviewer's decision. */
export function ClosureList({ closures }: { closures: ClosureItem[] }) {
  if (!closures.length) return null;
  return (
    <ul className="space-y-3">
      {closures.map((c) => (
        <li
          key={c.id}
          className="rounded-lg border border-zinc-200 p-3 text-sm dark:border-zinc-800"
        >
          <div className="flex flex-wrap items-center justify-between gap-1">
            <span className="font-semibold text-zinc-800 dark:text-zinc-100">
              Requested by {c.requestedByName}
            </span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {c.status.replace("_", " ")}
            </span>
          </div>
          <p className="text-xs text-zinc-400">{formatDate(c.requestedAt)}</p>
          {c.note && <p className="mt-1.5 whitespace-pre-wrap text-zinc-700 dark:text-zinc-200">{c.note}</p>}
          <p className="mt-2 text-xs text-zinc-500">Rule: {c.policy.text}</p>
          {c.decisions.length > 0 && (
            <ul className="mt-2 space-y-1.5 border-t border-zinc-100 pt-2 dark:border-zinc-900">
              {c.decisions.map((d) => (
                <li key={d.userId} className="text-xs">
                  <span className={`font-semibold ${DECISION_STYLE[d.decision]}`}>
                    {d.decision === "approve" ? "✓ Approved" : "✕ Rejected"}
                  </span>{" "}
                  by {d.name} ({ROLE_LABEL[d.role] ?? d.role}) · {formatDate(d.at)}
                  {d.reason && <p className="mt-0.5 text-zinc-600 dark:text-zinc-300">“{d.reason}”</p>}
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
