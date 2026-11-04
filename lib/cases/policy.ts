import type { ClosureDecision, Role } from "@/lib/models";
import { REVIEWER_ROLES } from "./workflow";

/**
 * Who has to approve a closure before a case is verified and closed.
 *
 * The organisation's rule was not written down anywhere in the app, so the
 * policy is configurable and the DEFAULT IS THE STRICTEST:
 *
 *   CASE_CLOSURE_POLICY = all        (default) Director, MIS and Programme
 *                                    Manager must each approve
 *                       = any        one approval from any of the three
 *                       = majority   approvals from two of the three roles
 *                       = a list     e.g. "programme_manager,mis" — each
 *                                    listed role must approve
 *
 * Any single rejection sends the case back to the CM for revision, whatever
 * the policy. The policy in force is copied onto each request when it is made,
 * so changing the setting never alters a request already under review.
 */
export interface ClosurePolicy {
  mode: "all" | "any" | "majority" | "roles";
  requiredRoles: Role[];
  /** Plain-language description shown to reviewers. */
  text: string;
}

const ROLE_LABEL: Record<string, string> = {
  director: "Director",
  mis: "MIS",
  programme_manager: "Programme Manager",
};

export function roleLabel(r: string): string {
  return ROLE_LABEL[r] ?? r;
}

export function closurePolicy(raw = process.env.CASE_CLOSURE_POLICY): ClosurePolicy {
  const all = [...REVIEWER_ROLES] as Role[];
  const v = (raw || "all").trim().toLowerCase();
  if (v === "any") {
    return { mode: "any", requiredRoles: all, text: "One approval from the Director, MIS or Programme Manager" };
  }
  if (v === "majority") {
    return { mode: "majority", requiredRoles: all, text: "Approval from any two of Director, MIS and Programme Manager" };
  }
  if (v !== "all") {
    const roles = v
      .split(/[,\s+]+/)
      .filter((r): r is Role => (REVIEWER_ROLES as readonly string[]).includes(r));
    if (roles.length) {
      return {
        mode: "roles",
        requiredRoles: [...new Set(roles)],
        text: `Approval from each of: ${roles.map(roleLabel).join(", ")}`,
      };
    }
  }
  return { mode: "all", requiredRoles: all, text: "Approval from the Director, MIS and Programme Manager (all three)" };
}

/** Roles that have approved. */
export function approvedRoles(decisions: ClosureDecision[]): Role[] {
  return [...new Set(decisions.filter((d) => d.decision === "approve").map((d) => d.role))];
}

type PolicyLike = { mode: string; requiredRoles: Role[] };

export function isSatisfied(
  policy: PolicyLike,
  decisions: ClosureDecision[]
): boolean {
  if (decisions.some((d) => d.decision === "reject")) return false;
  const got = approvedRoles(decisions);
  switch (policy.mode) {
    case "any":
      return got.length >= 1;
    case "majority":
      return got.length >= 2;
    default:
      return policy.requiredRoles.every((r) => got.includes(r));
  }
}

/** Roles whose approval is still missing (for the reviewer's progress line). */
export function pendingRoles(
  policy: PolicyLike,
  decisions: ClosureDecision[]
): Role[] {
  const got = approvedRoles(decisions);
  return policy.requiredRoles.filter((r) => !got.includes(r));
}
