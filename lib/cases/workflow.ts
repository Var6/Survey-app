import type { CaseDoc, CaseWorkflowStatus } from "@/lib/models";

/**
 * Follow-up and closure review states.
 *
 *   open ─► follow_up_in_progress ─► closure_requested ─► under_review ─► verified_closed
 *                  ▲                        │                   │
 *                  └──── revision_required ◄┴───────────────────┘   (a reviewer rejected)
 *
 * `under_review` starts once the first reviewer has recorded a decision.
 * Only reviewers (Director, MIS, Programme Manager) can move a case to
 * `verified_closed`; a Community Mobiliser can only request it.
 */
export const WORKFLOW: {
  key: CaseWorkflowStatus;
  label: string;
  tone: "zinc" | "sky" | "amber" | "violet" | "red" | "emerald";
}[] = [
  { key: "open", label: "Open", tone: "zinc" },
  { key: "follow_up_in_progress", label: "Follow-up in progress", tone: "sky" },
  { key: "closure_requested", label: "Closure requested", tone: "amber" },
  { key: "under_review", label: "Under review", tone: "violet" },
  { key: "revision_required", label: "Revision required", tone: "red" },
  { key: "verified_closed", label: "Verified & closed", tone: "emerald" },
];

export const WORKFLOW_LABEL: Record<string, string> = Object.fromEntries(
  WORKFLOW.map((w) => [w.key, w.label])
);

export const WORKFLOW_TONE: Record<string, string> = {
  zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  sky: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  amber: "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
  red: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
  emerald: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
};

export const WORKFLOW_KEYS = WORKFLOW.map((w) => w.key);

export function isWorkflowStatus(v: unknown): v is CaseWorkflowStatus {
  return typeof v === "string" && (WORKFLOW_KEYS as string[]).includes(v);
}

/** Cases created before the workflow existed carry no status — derive it. */
export function effectiveWorkflow(
  c: Pick<CaseDoc, "workflowStatus" | "closed">
): CaseWorkflowStatus {
  return c.workflowStatus ?? (c.closed ? "verified_closed" : "open");
}

/** States in which the CM may record a follow-up. */
export const CM_CAN_FOLLOW_UP: CaseWorkflowStatus[] = [
  "open",
  "follow_up_in_progress",
  "revision_required",
];
/**
 * States in which the CM may ask for the case to be closed. After a rejection
 * (`revision_required`) the CM must first record a new follow-up, which moves
 * the case back to follow_up_in_progress.
 */
export const CM_CAN_REQUEST_CLOSURE: CaseWorkflowStatus[] = ["follow_up_in_progress"];
/** States in which reviewers may approve or reject. */
export const REVIEWABLE: CaseWorkflowStatus[] = ["closure_requested", "under_review"];

/** Roles that review closures. */
export const REVIEWER_ROLES = ["director", "mis", "programme_manager"] as const;
