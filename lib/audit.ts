import type { ObjectId } from "mongodb";
import { auditCol, ensureIndexes, type UserDoc } from "./models";

export interface AuditInput {
  actor: Pick<UserDoc, "_id" | "name" | "role"> | { name: string; role: string; _id?: ObjectId };
  action: string;
  entityType: string;
  entityId: string;
  /** Human reference such as a case id — never a beneficiary name. */
  ref?: string;
  summary: string;
  meta?: Record<string, unknown>;
}

/**
 * Append one line to the audit trail. An audit failure must never undo the
 * action it describes, so errors are logged and swallowed.
 */
export async function audit(input: AuditInput): Promise<void> {
  try {
    await ensureIndexes();
    const col = await auditCol();
    await col.insertOne({
      at: new Date(),
      actorId: input.actor._id,
      actorName: input.actor.name,
      actorRole: input.actor.role,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ref: input.ref,
      summary: input.summary,
      meta: input.meta,
    });
  } catch (e) {
    console.error("[audit] could not write audit entry:", e);
  }
}
