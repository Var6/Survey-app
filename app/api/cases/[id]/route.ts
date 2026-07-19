import { ObjectId } from "mongodb";
import { json, handleError, requireRoles, readJson, HttpError } from "@/lib/api";
import { casesCol, type CaseHistoryEntry } from "@/lib/models";
import { publicCase } from "@/lib/serialize";
import { closedStage, MODULES, stageLabel } from "@/lib/cases/modules";

export const runtime = "nodejs";

function oid(id: string) {
  try {
    return new ObjectId(id);
  } catch {
    throw new HttpError(400, "Bad case id");
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireRoles("director", "mis", "programme_manager");
    const { id } = await ctx.params;
    const col = await casesCol();
    const doc = await col.findOne({ _id: oid(id) });
    if (!doc) throw new HttpError(404, "Case not found");
    return json({ case: publicCase(doc) });
  } catch (e) {
    return handleError(e);
  }
}

interface PatchBody {
  stage?: string;
  assignee?: string;
  priority?: "urgent" | "high" | "medium" | "low";
  dueDate?: string;
  fields?: Record<string, unknown>;
  note?: string;
  reopen?: boolean;
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager");
    const { id } = await ctx.params;
    const body = await readJson<PatchBody>(req);
    const col = await casesCol();
    const doc = await col.findOne({ _id: oid(id) });
    if (!doc) throw new HttpError(404, "Case not found");

    const set: Record<string, unknown> = { updatedAt: new Date() };
    const historyNotes: string[] = [];

    if (body.stage !== undefined) {
      const valid = MODULES[doc.module].workflow.some((w) => w.key === body.stage);
      if (!valid) throw new HttpError(400, "Invalid stage");
      set.stage = body.stage;
      const isClosed = body.stage === closedStage(doc.module);
      set.closed = isClosed;
      set.closedAt = isClosed ? new Date() : null;
      historyNotes.push(`Moved to “${stageLabel(doc.module, body.stage)}”`);
    }
    if (body.reopen) {
      set.closed = false;
      set.closedAt = null;
      historyNotes.push("Reopened");
    }
    if (body.assignee !== undefined) {
      set.assignee = body.assignee || undefined;
      historyNotes.push(body.assignee ? `Assigned to ${body.assignee}` : "Unassigned");
    }
    if (body.priority !== undefined) {
      set.priority = body.priority;
      historyNotes.push(`Priority set to ${body.priority}`);
    }
    if (body.dueDate !== undefined) {
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
        ...(historyEntry ? { $push: { history: historyEntry } } : {}),
      }
    );
    const updated = await col.findOne({ _id: doc._id });
    return json({ case: updated ? publicCase(updated) : null });
  } catch (e) {
    return handleError(e);
  }
}
