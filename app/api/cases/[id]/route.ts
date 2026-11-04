import { json, handleError, requireRoles, readJson, HttpError } from "@/lib/api";
import { casesCol, usersCol, caseClosuresCol, type CaseHistoryEntry } from "@/lib/models";
import { publicCase, publicFollowup, publicClosure } from "@/lib/serialize";
import { closedStage, MODULES, stageLabel } from "@/lib/cases/modules";
import { assertCanView, assignCm, loadCase, loadCaseActivity } from "@/lib/cases/service";
import { closurePolicy } from "@/lib/cases/policy";
import { audit } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const { id } = await ctx.params;
    const doc = await loadCase(id);
    assertCanView(user, doc);

    const { followups, closures } = await loadCaseActivity(doc);
    const users = await usersCol();
    const cm = await users.findOne(
      { _id: (doc.assignedCmId ?? doc.mobiliserId)! },
      { projection: { name: 1 } }
    );
    return json({
      case: publicCase(doc, { assignedCmName: cm?.name }),
      followups: followups.map(publicFollowup),
      closures: closures.map(publicClosure),
      policy: closurePolicy(),
    });
  } catch (e) {
    return handleError(e);
  }
}

interface PatchBody {
  stage?: string;
  assignee?: string;
  assignedCmId?: string;
  priority?: "urgent" | "high" | "medium" | "low";
  dueDate?: string;
  fields?: Record<string, unknown>;
  note?: string;
  reopen?: boolean;
}

/** Staff-only edits. A Community Mobiliser cannot change or close a case here. */
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager");
    const { id } = await ctx.params;
    const body = await readJson<PatchBody>(req);
    const doc = await loadCase(id);
    const col = await casesCol();

    const set: Record<string, unknown> = { updatedAt: new Date() };
    const unset: Record<string, ""> = {};
    const historyNotes: string[] = [];

    if (body.stage !== undefined) {
      const valid = MODULES[doc.module].workflow.some((w) => w.key === body.stage);
      if (!valid) throw new HttpError(400, "Invalid stage");
      set.stage = body.stage;
      const isClosed = body.stage === closedStage(doc.module);
      set.closed = isClosed;
      set.closedAt = isClosed ? new Date() : null;
      if (isClosed) {
        // A reviewer closing directly settles any pending closure request.
        set.workflowStatus = "verified_closed";
        set.closedVia = "staff";
        unset.closureRequestId = "";
      } else if (doc.closed) {
        set.workflowStatus = "open";
      }
      historyNotes.push(`Moved to “${stageLabel(doc.module, body.stage)}”`);
    }
    if (body.reopen) {
      set.closed = false;
      set.closedAt = null;
      set.workflowStatus = "open";
      historyNotes.push("Reopened");
    }
    if (body.assignee !== undefined) {
      set.assignee = body.assignee || undefined;
      historyNotes.push(body.assignee ? `Assigned to ${body.assignee}` : "Unassigned");
    }
    if (body.priority !== undefined) {
      if (!["urgent", "high", "medium", "low"].includes(body.priority))
        throw new HttpError(400, "Invalid priority");
      set.priority = body.priority;
      historyNotes.push(`Priority set to ${body.priority}`);
    }
    if (body.dueDate !== undefined) {
      if (body.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(body.dueDate))
        throw new HttpError(400, "Invalid due date");
      set.dueDate = body.dueDate || undefined;
      historyNotes.push(body.dueDate ? `Due date ${body.dueDate}` : "Due date cleared");
    }
    if (body.fields !== undefined) {
      set.fields = { ...(doc.fields || {}), ...body.fields };
      historyNotes.push("Case details updated");
    }

    const note = body.note?.trim();
    const historyEntry: CaseHistoryEntry | null =
      historyNotes.length || note
        ? {
            at: new Date(),
            stage: (set.stage as string) ?? doc.stage,
            note: note ? note : historyNotes.join("; "),
            by: user.name,
          }
        : null;

    await col.updateOne(
      { _id: doc._id },
      {
        $set: set,
        ...(Object.keys(unset).length ? { $unset: unset } : {}),
        ...(historyEntry ? { $push: { history: historyEntry } } : {}),
      }
    );

    // Closed or reopened by staff: a pending closure request is superseded.
    if ((set.closed === true || body.reopen) && doc.closureRequestId) {
      await (await caseClosuresCol()).updateOne(
        { _id: doc.closureRequestId, status: { $in: ["pending", "under_review"] } },
        { $set: { status: "superseded", resolvedAt: new Date(), updatedAt: new Date() } }
      );
    }
    if (body.assignedCmId) await assignCm(user, doc, body.assignedCmId);

    if (set.closed === true || body.reopen || body.priority || body.assignedCmId) {
      await audit({
        actor: user,
        action: set.closed === true ? "case.closed_by_staff" : body.reopen ? "case.reopened" : "case.updated",
        entityType: "case",
        entityId: String(doc._id),
        ref: doc.caseId,
        summary: historyEntry?.note || "Case updated",
      });
    }

    const updated = await loadCase(id);
    return json({ case: publicCase(updated) });
  } catch (e) {
    return handleError(e);
  }
}
