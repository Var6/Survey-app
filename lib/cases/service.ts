import { ObjectId } from "mongodb";
import { HttpError } from "@/lib/api";
import {
  casesCol,
  caseClosuresCol,
  caseFollowupsCol,
  usersCol,
  ensureIndexes,
  type CaseDoc,
  type CaseFollowupDoc,
  type CaseClosureDoc,
  type CaseHistoryEntry,
  type UserDoc,
} from "@/lib/models";
import { audit } from "@/lib/audit";
import { supportRecordsCol } from "@/lib/models";
import { notifyRoles, notifyUsers } from "@/lib/notifications";
import { isDateStr, istToday } from "@/lib/time";
import { closedStage, MODULES } from "./modules";
import { closurePolicy, isSatisfied, pendingRoles, roleLabel } from "./policy";
import {
  CM_CAN_FOLLOW_UP,
  CM_CAN_REQUEST_CLOSURE,
  REVIEWABLE,
  REVIEWER_ROLES,
  WORKFLOW_LABEL,
  effectiveWorkflow,
} from "./workflow";

/**
 * Follow-up → closure request → review.
 *
 * Every state change is a single conditional update (the filter names the
 * state we expect), so two people acting at once can never both win and a
 * double tap cannot apply twice. That gives us the guarantees a transaction
 * would, without needing a replica set. Each change appends to the case
 * history and writes an audit entry.
 */

export function toId(v: string, what = "id"): ObjectId {
  try {
    return new ObjectId(v);
  } catch {
    throw new HttpError(400, `Invalid ${what}`);
  }
}

/** Does this CM own the case? (assigned to them, or — older cases — surveyed by them) */
export function isCmsCase(c: Pick<CaseDoc, "assignedCmId" | "mobiliserId">, userId: ObjectId) {
  const owner = c.assignedCmId ?? c.mobiliserId;
  return !!owner && String(owner) === String(userId);
}

export async function loadCase(id: string): Promise<CaseDoc> {
  const col = await casesCol();
  const doc = await col.findOne({ _id: toId(id, "case id") });
  if (!doc) throw new HttpError(404, "Case not found");
  return doc;
}

/** CMs see only their own cases; office reviewers see all. */
export function assertCanView(user: UserDoc, c: CaseDoc) {
  if (user.role === "cm" && !isCmsCase(c, user._id!)) {
    throw new HttpError(404, "Case not found");
  }
}

const hist = (stage: string, note: string, by: string): CaseHistoryEntry => ({
  at: new Date(),
  stage,
  note,
  by,
});

const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/* ── 1. CM records a follow-up ──────────────────────────────── */
export interface FollowupInput {
  followupDate?: unknown;
  observations?: unknown;
  actionsTaken?: unknown;
  remarks?: unknown;
  attachments?: unknown;
  clientKey?: unknown;
  /** Save without submitting. */
  draft?: unknown;
  /** Continue an existing draft. */
  followupId?: unknown;
}

/**
 * Evidence photos must be files this app uploaded: a key under uploads/ and,
 * when image storage is configured, a URL on that storage. Anything else is
 * dropped, so a follow-up can never embed an arbitrary outside link.
 */
function cleanAttachments(v: unknown): CaseFollowupDoc["attachments"] {
  if (!Array.isArray(v)) return [];
  const base = (process.env.R2_PUBLIC_BASE_URL || "").replace(/\/$/, "");
  return v
    .slice(0, 6)
    .map((a) => ({
      key: clip((a as { key?: unknown })?.key, 300),
      url: clip((a as { url?: unknown })?.url, 1000),
      name: clip((a as { name?: unknown })?.name, 120) || undefined,
    }))
    .filter(
      (a) =>
        /^uploads\//.test(a.key) &&
        /^https:\/\//.test(a.url) &&
        (!base || a.url.startsWith(`${base}/`))
    );
}

export async function recordFollowup(user: UserDoc, caseId: string, input: FollowupInput) {
  if (user.role !== "cm") throw new HttpError(403, "Only the Community Mobiliser records follow-ups");
  await ensureIndexes();
  const c = await loadCase(caseId);
  if (!isCmsCase(c, user._id!)) throw new HttpError(404, "Case not found");

  const status = effectiveWorkflow(c);
  if (c.closed || !CM_CAN_FOLLOW_UP.includes(status)) {
    throw new HttpError(
      409,
      status === "closure_requested" || status === "under_review"
        ? "This case is waiting for closure review — follow-ups are paused."
        : "This case is closed."
    );
  }

  const draft = input.draft === true;
  const followupDate = clip(input.followupDate, 10);
  const observations = clip(input.observations, 4000);
  const actionsTaken = clip(input.actionsTaken, 4000);
  const remarks = clip(input.remarks, 2000) || undefined;
  const attachments = cleanAttachments(input.attachments);
  const clientKey = clip(input.clientKey, 80) || undefined;

  if (!isDateStr(followupDate)) throw new HttpError(400, "Enter the follow-up date");
  if (followupDate > istToday()) throw new HttpError(400, "The follow-up date cannot be in the future");
  if (!draft) {
    if (!observations) throw new HttpError(400, "Write what you observed");
    if (!actionsTaken) throw new HttpError(400, "Write what action you took");
  }

  const col = await caseFollowupsCol();
  const now = new Date();

  // Continue a draft the CM owns, or start a new record.
  let followupId: ObjectId;
  if (input.followupId) {
    followupId = toId(String(input.followupId), "follow-up id");
    const res = await col.updateOne(
      { _id: followupId, caseId: c._id, cmId: user._id, status: "draft" },
      {
        $set: {
          followupDate,
          observations,
          actionsTaken,
          remarks,
          attachments,
          updatedAt: now,
          ...(clientKey ? { clientKey } : {}),
        },
      }
    );
    if (!res.matchedCount) throw new HttpError(409, "That draft is no longer editable");
  } else {
    const doc: CaseFollowupDoc = {
      caseId: c._id!,
      caseCode: c.caseId,
      cmId: user._id!,
      cmName: user.name,
      followupDate,
      observations,
      actionsTaken,
      remarks,
      attachments,
      clientKey,
      status: "draft",
      createdAt: now,
      updatedAt: now,
    };
    try {
      const ins = await col.insertOne(doc);
      followupId = ins.insertedId;
    } catch (e) {
      // Same clientKey again = the same tap arriving twice: hand back the first.
      if ((e as { code?: number }).code === 11000 && clientKey) {
        const first = await col.findOne({ caseId: c._id, clientKey });
        if (first) return { followup: first, duplicate: true };
      }
      throw e;
    }
  }

  if (draft) {
    const saved = await col.findOne({ _id: followupId });
    return { followup: saved!, duplicate: false };
  }

  // Submit: claim the draft so a second request cannot also submit it.
  const claimed = await col.findOneAndUpdate(
    { _id: followupId, status: "draft" },
    { $set: { status: "submitted", submittedAt: now, updatedAt: now } },
    { returnDocument: "after" }
  );
  if (!claimed) {
    const already = await col.findOne({ _id: followupId });
    if (already) return { followup: already, duplicate: true };
    throw new HttpError(409, "Could not save this follow-up");
  }

  const cases = await casesCol();
  const moved = await cases.updateOne(
    {
      _id: c._id,
      closed: false,
      $or: CM_CAN_FOLLOW_UP.map((s) =>
        s === "open"
          ? { $or: [{ workflowStatus: "open" }, { workflowStatus: null }] }
          : { workflowStatus: s }
      ),
    } as never,
    {
      $set: { workflowStatus: "follow_up_in_progress", lastFollowupAt: now, updatedAt: now },
      $inc: { followupCount: 1 },
      $push: {
        history: hist(
          c.stage,
          `Follow-up recorded by ${user.name} (${followupDate})`,
          user.name
        ),
      },
    } as never
  );
  if (!moved.matchedCount) {
    // The case moved on while we were saving (e.g. closure requested): undo.
    await col.updateOne(
      { _id: followupId },
      { $set: { status: "draft", updatedAt: new Date() }, $unset: { submittedAt: "" } }
    );
    throw new HttpError(409, "The case changed while saving — please reload and try again");
  }

  const mod = MODULES[c.module];
  await notifyRoles(["mis", "programme_manager"], {
    category: "followup_completed",
    title: `Follow-up completed · ${c.caseId}`,
    body: `${user.name} recorded a follow-up on ${c.caseId} (${mod.short}, household ${c.householdId}) dated ${followupDate}.`,
    relatedType: "case",
    relatedId: String(c._id),
    dedupeKey: `followup:${followupId}`,
  });
  await audit({
    actor: user,
    action: "case.followup_submitted",
    entityType: "case",
    entityId: String(c._id),
    ref: c.caseId,
    summary: `Follow-up submitted (${followupDate})`,
    meta: { followupId: String(followupId) },
  });

  return { followup: claimed, duplicate: false };
}

/* ── 2. CM asks for closure ─────────────────────────────────── */
export async function requestClosure(user: UserDoc, caseId: string, noteRaw: unknown) {
  if (user.role !== "cm") throw new HttpError(403, "Only the Community Mobiliser requests closure");
  await ensureIndexes();
  const c = await loadCase(caseId);
  if (!isCmsCase(c, user._id!)) throw new HttpError(404, "Case not found");

  const status = effectiveWorkflow(c);
  if (c.closed || !CM_CAN_REQUEST_CLOSURE.includes(status)) {
    throw new HttpError(
      409,
      status === "open"
        ? "Record at least one follow-up before asking to close this case."
        : status === "revision_required"
        ? "Record a new follow-up addressing the reviewer's comments first."
        : "Closure has already been requested or the case is closed."
    );
  }
  const note = clip(noteRaw, 2000);
  if (!note) throw new HttpError(400, "Explain why this case can be closed");

  const submitted = await (await caseFollowupsCol()).countDocuments({
    caseId: c._id,
    status: "submitted",
  });
  if (submitted === 0) throw new HttpError(409, "Record at least one follow-up first.");

  const policy = closurePolicy();
  const requestId = new ObjectId();
  const now = new Date();

  // Claim the case first; if two requests race only one passes this guard.
  const cases = await casesCol();
  const claimed = await cases.updateOne(
    { _id: c._id, closed: false, workflowStatus: "follow_up_in_progress" },
    {
      $set: { workflowStatus: "closure_requested", closureRequestId: requestId, updatedAt: now },
      $push: { history: hist(c.stage, `Closure requested by ${user.name}`, user.name) },
    } as never
  );
  if (!claimed.matchedCount) {
    throw new HttpError(409, "Closure has already been requested for this case.");
  }

  const doc: CaseClosureDoc = {
    _id: requestId,
    caseId: c._id!,
    caseCode: c.caseId,
    requestedBy: user._id!,
    requestedByName: user.name,
    requestedAt: now,
    note,
    status: "pending",
    policy,
    decisions: [],
    createdAt: now,
    updatedAt: now,
  };
  try {
    await (await caseClosuresCol()).insertOne(doc);
  } catch (e) {
    await cases.updateOne(
      { _id: c._id, closureRequestId: requestId },
      { $set: { workflowStatus: "follow_up_in_progress" }, $unset: { closureRequestId: "" } }
    );
    throw e;
  }

  await notifyRoles([...REVIEWER_ROLES], {
    category: "closure_requested",
    title: `Closure requested · ${c.caseId}`,
    body: `${user.name} asks to close ${c.caseId} (${MODULES[c.module].short}, household ${c.householdId}). ${policy.text}.`,
    relatedType: "case",
    relatedId: String(c._id),
    dedupeKey: `closure_requested:${requestId}`,
  });
  await audit({
    actor: user,
    action: "case.closure_requested",
    entityType: "case",
    entityId: String(c._id),
    ref: c.caseId,
    summary: "Closure requested",
    meta: { closureId: String(requestId), policy: policy.mode },
  });
  return doc;
}

/* ── 3. Reviewers decide ────────────────────────────────────── */
export async function reviewClosure(
  user: UserDoc,
  caseId: string,
  decision: "approve" | "reject",
  reasonRaw: unknown
) {
  if (!(REVIEWER_ROLES as readonly string[]).includes(user.role)) {
    throw new HttpError(403, "Only the Director, MIS or Programme Manager can review a closure");
  }
  if (decision !== "approve" && decision !== "reject") {
    throw new HttpError(400, "Choose approve or reject");
  }
  const reason = clip(reasonRaw, 2000);
  if (decision === "reject" && reason.length < 3) {
    throw new HttpError(400, "Give a reason when rejecting");
  }

  const c = await loadCase(caseId);
  const status = effectiveWorkflow(c);
  if (!REVIEWABLE.includes(status) || !c.closureRequestId) {
    throw new HttpError(409, "There is no closure request waiting for review on this case.");
  }

  const closures = await caseClosuresCol();
  const cases = await casesCol();
  const open = { $in: ["pending", "under_review"] } as const;
  const mod = MODULES[c.module];
  const cmId = c.assignedCmId ?? c.mobiliserId;
  const stamp = new Date();

  const entry = {
    userId: user._id!,
    name: user.name,
    role: user.role,
    decision,
    reason: reason || undefined,
    at: stamp,
  };

  // Record this reviewer's decision — once per person, only while the request is open.
  const updated = await closures.findOneAndUpdate(
    {
      _id: c.closureRequestId,
      status: open,
      "decisions.userId": { $ne: user._id },
    } as never,
    {
      $push: { decisions: entry },
      $set: { status: decision === "reject" ? "rejected" : "under_review", updatedAt: stamp },
    } as never,
    { returnDocument: "after" }
  );
  if (!updated) {
    const cur = await closures.findOne({ _id: c.closureRequestId });
    if (cur && cur.decisions.some((d) => String(d.userId) === String(user._id))) {
      throw new HttpError(409, "You have already reviewed this request.");
    }
    throw new HttpError(409, "This request was already decided.");
  }

  /* Rejected: back to the CM. */
  if (decision === "reject") {
    await closures.updateOne({ _id: updated._id }, { $set: { resolvedAt: stamp } });
    // The support form that asked for this closure goes back to the CM too.
    await (await supportRecordsCol()).updateMany(
      { caseId: c._id, verification: "pending" },
      { $set: { verification: "rejected", updatedAt: stamp } }
    );
    await cases.updateOne(
      { _id: c._id, closureRequestId: updated._id },
      {
        $set: { workflowStatus: "revision_required", updatedAt: stamp },
        $unset: { closureRequestId: "" },
        $push: {
          history: hist(
            c.stage,
            `Closure rejected by ${user.name} (${roleLabel(user.role)}): ${reason}`,
            user.name
          ),
        },
      } as never
    );
    if (cmId) {
      await notifyUsers([cmId], {
        category: "closure_rejected",
        title: `Closure not approved · ${c.caseId}`,
        body: `${user.name} (${roleLabel(user.role)}) sent ${c.caseId} back: ${reason}`,
        relatedType: "case",
        relatedId: String(c._id),
        dedupeKey: `closure_rejected:${updated._id}`,
      });
    }
    await notifyRoles(
      [...REVIEWER_ROLES],
      {
        category: "closure_rejected",
        title: `Closure rejected · ${c.caseId}`,
        body: `${user.name} (${roleLabel(user.role)}) rejected the closure of ${c.caseId}.`,
        relatedType: "case",
        relatedId: String(c._id),
        dedupeKey: `closure_rejected:${updated._id}`,
      },
      { excludeUserId: user._id }
    );
    await audit({
      actor: user,
      action: "case.closure_rejected",
      entityType: "case",
      entityId: String(c._id),
      ref: c.caseId,
      summary: `Closure rejected: ${reason}`,
      meta: { closureId: String(updated._id) },
    });
    return { outcome: "rejected" as const, closure: updated };
  }

  /* Approved by this reviewer — is the policy now satisfied? */
  if (isSatisfied(updated.policy, updated.decisions)) {
    // Exactly one concurrent reviewer wins this transition.
    const final = await closures.findOneAndUpdate(
      { _id: updated._id, status: open } as never,
      { $set: { status: "approved", resolvedAt: stamp, updatedAt: stamp } },
      { returnDocument: "after" }
    );
    if (final) {
      await cases.updateOne(
        { _id: c._id, closureRequestId: updated._id },
        {
          $set: {
            workflowStatus: "verified_closed",
            closedVia: "review",
            closed: true,
            closedAt: stamp,
            stage: closedStage(c.module),
            updatedAt: stamp,
          },
          $unset: { closureRequestId: "" },
          $push: {
            history: hist(
              closedStage(c.module),
              `Closure verified — ${updated.decisions
                .filter((d) => d.decision === "approve")
                .map((d) => `${d.name} (${roleLabel(d.role)})`)
                .join(", ")}`,
              user.name
            ),
          },
        } as never
      );
      await (await supportRecordsCol()).updateMany(
        { caseId: c._id, verification: "pending" },
        { $set: { verification: "verified", updatedAt: stamp } }
      );
      const ids = cmId ? [cmId] : [];
      await notifyUsers(ids, {
        category: "closure_approved",
        title: `Case closed · ${c.caseId}`,
        body: `${c.caseId} (${mod.short}) has been verified and closed.`,
        relatedType: "case",
        relatedId: String(c._id),
        dedupeKey: `closure_approved:${updated._id}`,
      });
      await notifyRoles([...REVIEWER_ROLES], {
        category: "closure_approved",
        title: `Closure verified · ${c.caseId}`,
        body: `${c.caseId} (${mod.short}) is verified and closed. ${updated.policy.text}.`,
        relatedType: "case",
        relatedId: String(c._id),
        dedupeKey: `closure_approved:${updated._id}`,
      });
      await audit({
        actor: user,
        action: "case.closure_verified",
        entityType: "case",
        entityId: String(c._id),
        ref: c.caseId,
        summary: "Closure verified — case closed",
        meta: { closureId: String(updated._id) },
      });
      return { outcome: "closed" as const, closure: final };
    }
  }

  // Not yet enough approvals: the case is now under review.
  const waiting = pendingRoles(updated.policy, updated.decisions).map(roleLabel);
  await cases.updateOne(
    { _id: c._id, closureRequestId: updated._id, closed: false },
    {
      $set: { workflowStatus: "under_review", updatedAt: stamp },
      $push: {
        history: hist(
          c.stage,
          `Closure approved by ${user.name} (${roleLabel(user.role)})${
            waiting.length ? ` — waiting for ${waiting.join(", ")}` : ""
          }`,
          user.name
        ),
      },
    } as never
  );
  await audit({
    actor: user,
    action: "case.closure_approved_step",
    entityType: "case",
    entityId: String(c._id),
    ref: c.caseId,
    summary: `Closure approved by ${roleLabel(user.role)}`,
    meta: { closureId: String(updated._id), waiting },
  });
  return { outcome: "under_review" as const, closure: updated, waiting };
}

/* ── 4. Staff reassign the responsible CM ───────────────────── */
export async function assignCm(user: UserDoc, c: CaseDoc, cmIdRaw: string) {
  const cmId = toId(cmIdRaw, "CM id");
  const target = await (await usersCol()).findOne({ _id: cmId, role: "cm", active: { $ne: false } });
  if (!target) throw new HttpError(400, "Choose an active Community Mobiliser");
  const cases = await casesCol();
  const stamp = new Date();
  await cases.updateOne(
    { _id: c._id },
    {
      $set: { assignedCmId: cmId, updatedAt: stamp },
      $push: { history: hist(c.stage, `Assigned to ${target.name}`, user.name) },
    } as never
  );
  await notifyUsers([cmId], {
    category: "case_opened",
    title: `Case assigned to you · ${c.caseId}`,
    body: `${user.name} assigned ${c.caseId} (${MODULES[c.module].short}, household ${c.householdId}) to you. Record your follow-up.`,
    relatedType: "case",
    relatedId: String(c._id),
    dedupeKey: `case_assigned:${c._id}:${cmId}:${stamp.getTime()}`,
  });
  await audit({
    actor: user,
    action: "case.assigned",
    entityType: "case",
    entityId: String(c._id),
    ref: c.caseId,
    summary: `Assigned to ${target.name}`,
  });
  return target;
}

/* ── Shared read model for the detail views ─────────────────── */
export async function loadCaseActivity(c: CaseDoc) {
  const [followups, closures] = await Promise.all([
    (await caseFollowupsCol())
      .find({ caseId: c._id, status: "submitted" })
      .sort({ submittedAt: -1 })
      .limit(100)
      .toArray(),
    (await caseClosuresCol()).find({ caseId: c._id }).sort({ requestedAt: -1 }).limit(20).toArray(),
  ]);
  return { followups, closures };
}

export { WORKFLOW_LABEL };
