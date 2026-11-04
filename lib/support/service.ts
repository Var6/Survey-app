import { ObjectId } from "mongodb";
import { HttpError } from "@/lib/api";
import {
  casesCol,
  caseClosuresCol,
  settlementsCol,
  supportRecordsCol,
  usersCol,
  ensureIndexes,
  type CaseDoc,
  type SupportRecordDoc,
  type UserDoc,
} from "@/lib/models";
import { audit } from "@/lib/audit";
import { notifyRoles } from "@/lib/notifications";
import { closedStage } from "@/lib/cases/modules";
import { isCmsCase, loadCase, recordFollowup, requestClosure } from "@/lib/cases/service";
import { clip } from "@/lib/schedule";
import { istToday, isDateStr } from "@/lib/time";
import { parseLinks } from "@/lib/meeting-records";
import { getSettlement } from "@/lib/settlements";
import { REFERRAL_BY_KEY, detailFields, supportTypesFor, typeLabels } from "./schema";
import { matchRecord } from "./match";
import { evaluateCase } from "./evidence";

/** Close a case without the CM-request / review steps: for the Google Sheet import and staff linking. */
export async function closeCaseDirect(
  c: CaseDoc,
  o: { via: "import" | "staff"; by: string; at?: Date; note: string }
): Promise<boolean> {
  const cases = await casesCol();
  const at = o.at ?? new Date();
  const stage = closedStage(c.module);
  const res = await cases.updateOne(
    { _id: c._id, closed: false },
    {
      $set: { closed: true, closedAt: at, stage, workflowStatus: "verified_closed", closedVia: o.via, updatedAt: new Date() },
      $unset: { closureRequestId: "" },
      $push: { history: { at, stage, note: o.note, by: o.by } },
    } as never
  );
  if (!res.matchedCount) return false;
  await (await caseClosuresCol()).updateMany(
    { caseId: c._id, status: { $in: ["pending", "under_review"] } },
    { $set: { status: "superseded", resolvedAt: new Date(), updatedAt: new Date() } }
  );
  return true;
}

/** Ten digits or nothing — the sheet has "NA" and repeated numbers. */
export function cleanPhone(v: unknown): string | undefined {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length === 10 ? d : undefined;
}

export interface SupportInput {
  supportDate?: unknown;
  settlementCode?: unknown;
  referral?: unknown;
  beneficiaryName?: unknown;
  phone?: unknown;
  supportTypes?: unknown;
  details?: unknown;
  photoLinks?: unknown;
  status?: unknown;
  remarks?: unknown;
  /** Attach to this case; with status "complete" this also asks for the case to be closed. */
  caseId?: unknown;
}

/** Everything validated and cleaned, ready to store. */
export async function cleanInput(input: SupportInput) {
  const supportDate = clip(input.supportDate, 10);
  if (!isDateStr(supportDate)) throw new HttpError(400, "Choose the date");
  if (supportDate > istToday()) throw new HttpError(400, "The date cannot be in the future");

  const settlement = await getSettlement(clip(input.settlementCode, 60));
  if (!settlement) throw new HttpError(400, "Choose the community");

  const referral = REFERRAL_BY_KEY[clip(input.referral, 40)];
  if (!referral) throw new HttpError(400, "Choose the referral");

  const beneficiaryName = clip(input.beneficiaryName, 120);
  if (beneficiaryName.length < 2) throw new HttpError(400, "Write the beneficiary's name");

  const phoneRaw = clip(input.phone, 20);
  const phone = cleanPhone(phoneRaw);
  if (phoneRaw && !phone && !/^(na|n\/a|-)$/i.test(phoneRaw)) {
    throw new HttpError(400, "Phone number must be 10 digits");
  }

  const allowed = supportTypesFor(referral.key);
  const wanted = Array.isArray(input.supportTypes) ? input.supportTypes.map(String) : [];
  const supportTypes = [...new Set(wanted)];
  if (!supportTypes.length) throw new HttpError(400, "Choose the type of support");
  if (supportTypes.some((t) => !allowed.some((a) => a.key === t))) {
    throw new HttpError(400, "That type of support does not belong to this referral");
  }

  // Answers on the referral's own page: only the questions that page asks.
  const src = (input.details && typeof input.details === "object" ? input.details : {}) as Record<string, unknown>;
  const details: Record<string, string> = {};
  for (const f of detailFields(referral.key)) {
    const v = clip(src[f.key], 300);
    if (!v) continue;
    if (f.type === "date" && !isDateStr(v)) throw new HttpError(400, `${f.label}: enter a valid date`);
    if (f.type === "yesno" && !["yes", "no"].includes(v)) throw new HttpError(400, `${f.label}: choose Yes or No`);
    details[f.key] = v;
  }

  const status: "complete" | "follow_up_required" | null =
    input.status === "complete" ? "complete" : input.status === "follow_up_required" ? "follow_up_required" : null;
  if (!status) throw new HttpError(400, "Choose the status: Complete or Follow-up required");

  return {
    supportDate,
    settlementCode: settlement.code,
    communityName: settlement.label,
    referral: referral.key,
    referralLabel: referral.label,
    beneficiaryName,
    phone,
    supportTypes,
    supportTypeLabels: typeLabels(referral.key, supportTypes),
    details,
    photoLinks: parseLinks(input.photoLinks, "Photo"),
    status,
    remarks: clip(input.remarks, 3000) || undefined,
  };
}

/** One readable paragraph of what was done — used as the follow-up text on the case. */
function summarise(r: Pick<SupportRecordDoc, "referralLabel" | "supportTypeLabels" | "status" | "details" | "remarks" | "beneficiaryName">) {
  const extras = Object.entries(r.details).map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
  return [
    `${r.referralLabel}: ${r.supportTypeLabels.join(", ")} for ${r.beneficiaryName} — ${r.status === "complete" ? "complete" : "follow-up required"}.`,
    ...(extras.length ? [extras.join("; ")] : []),
    ...(r.remarks ? [r.remarks] : []),
  ].join(" ");
}

/**
 * A CM (or office user) files the support form.
 *
 *  - With a case: it counts as the follow-up. "Complete" then asks for the
 *    case to be closed — MIS, PM and Director verify it as usual. "Follow-up
 *    required" records the follow-up and leaves the case open.
 *  - Without a case: it is stored and, for the office to confirm, matched to
 *    likely cases — nothing is closed on a guess.
 */
export async function createSupportRecord(user: UserDoc, input: SupportInput) {
  await ensureIndexes();
  const clean = await cleanInput(input);
  const now = new Date();

  let theCase: CaseDoc | null = null;
  if (input.caseId) {
    theCase = await loadCase(String(input.caseId));
    if (user.role === "cm" && !isCmsCase(theCase, user._id!)) throw new HttpError(404, "Case not found");
    if (theCase.module !== clean.referral) throw new HttpError(400, "This form's referral does not match the case");
    if (theCase.settlementCode !== clean.settlementCode) throw new HttpError(400, "This form's community does not match the case");
    if (theCase.closed) throw new HttpError(409, "This case is already closed");
  }

  const doc: SupportRecordDoc = {
    ...clean,
    linkStatus: theCase ? "linked" : "unlinked",
    ...(theCase ? { caseId: theCase._id, caseCode: theCase.caseId, householdId: theCase.householdId } : {}),
    verification: "not_needed",
    ...(user.role === "cm" ? { cmId: user._id, cmName: user.name } : {}),
    source: "app",
    submittedAt: now,
    history: [{ at: now, by: user.name, note: user.role === "cm" ? "Filed" : `Entered by ${user.name}` }],
    createdAt: now,
    updatedAt: now,
  };

  if (!theCase) {
    // Suggest likely cases for the office to confirm. Never acted on automatically.
    const m = await matchRecord({ settlementCode: clean.settlementCode, referral: clean.referral, beneficiaryName: clean.beneficiaryName, typeKeys: clean.supportTypes });
    doc.suggestions = m.suggestions;
    if (m.suggestions.length) doc.linkStatus = "suggested";
  }

  const col = await supportRecordsCol();
  const ins = await col.insertOne(doc);
  const id = ins.insertedId;

  if (theCase) {
    try {
      const text = summarise(clean);
      await recordFollowup(user, String(theCase._id), {
        followupDate: clean.supportDate,
        observations: text,
        actionsTaken: `${clean.supportTypeLabels.join(", ")} — ${clean.status === "complete" ? "complete" : "follow-up required"}`,
        remarks: clean.remarks,
        attachments: [],
        clientKey: `support:${id}`,
      });
      if (clean.status === "complete") {
        const closure = await requestClosure(user, String(theCase._id), text);
        await col.updateOne({ _id: id }, { $set: { closureId: closure._id, verification: "pending" } });
        doc.verification = "pending";
      }
    } catch (e) {
      // The case could not take the follow-up / closure: do not leave a record behind.
      await col.deleteOne({ _id: id });
      throw e;
    }
  } else {
    await notifyRoles(["mis", "programme_manager", "director"], {
      category: "support_record",
      title: `Support record · ${clean.communityName}`,
      body: `${user.name} filed ${clean.referralLabel} (${clean.supportTypeLabels.join(", ")}) for a beneficiary in ${clean.communityName} — ${clean.status === "complete" ? "complete" : "follow-up required"}.`,
      relatedType: "support_record",
      relatedId: String(id),
      dedupeKey: `support_record:${id}`,
    }, { excludeUserId: user._id });
  }

  await audit({
    actor: user,
    action: "support_record.created",
    entityType: "support_record",
    entityId: String(id),
    ref: theCase?.caseId ?? clean.communityName,
    summary: `Support filed: ${clean.referralLabel} (${clean.status})`,
  });
  return { ...doc, _id: id };
}

/** MIS / PM / Director attach an unlinked record to a case, optionally closing it. */
export async function linkSupportRecord(user: UserDoc, recordId: ObjectId, caseId: string, close: boolean, force = false) {
  const col = await supportRecordsCol();
  const rec = await col.findOne({ _id: recordId });
  if (!rec) throw new HttpError(404, "Record not found");
  const c = await loadCase(caseId);
  if (c.module !== rec.referral) throw new HttpError(400, "The case is in a different area than this record");
  if (c.settlementCode !== rec.settlementCode) throw new HttpError(400, "The case is in a different community");

  // Closing needs the whole picture: every document the case lists, not just this record.
  let verdict: ReturnType<typeof evaluateCase> | null = null;
  if (close) {
    if (rec.status !== "complete") throw new HttpError(409, "Only a Complete record can close a case");
    const others = await col.find({ caseId: c._id, _id: { $ne: rec._id } }).toArray();
    verdict = evaluateCase(c, [...others, rec]);
    if (!verdict.close && !force) {
      throw new HttpError(
        409,
        `This record does not finish the case yet — still needed: ${verdict.need.join(", ") || "more support"}. Link without closing, or choose “close anyway”.`
      );
    }
  }

  const now = new Date();
  await col.updateOne(
    { _id: rec._id },
    {
      $set: { caseId: c._id, caseCode: c.caseId, householdId: c.householdId, linkStatus: "linked", updatedAt: now },
      $unset: { suggestions: "" },
      $push: { history: { at: now, by: user.name, note: `Linked to ${c.caseId}${close ? " and case closed" : ""}` } },
    } as never
  );
  let closed = false;
  if (close) {
    closed = await closeCaseDirect(c, {
      via: "staff",
      by: user.name,
      at: new Date(`${rec.supportDate}T12:00:00+05:30`),
      note: `Closed by ${user.name} from a verified support record: ${rec.supportTypeLabels.join(", ")} (${rec.supportDate})`,
    });
    if (closed) await col.updateOne({ _id: rec._id }, { $set: { verification: "verified" } });
  }
  await audit({
    actor: user,
    action: close ? "support_record.linked_and_closed" : "support_record.linked",
    entityType: "support_record",
    entityId: String(rec._id),
    ref: c.caseId,
    summary: close ? "Linked to case and closed it" : "Linked to case",
  });
  return { caseCode: c.caseId, closed };
}

/** Review outcome of a case's closure request → the support record it was made from. */
export async function setVerification(caseId: ObjectId, verification: "verified" | "rejected") {
  await (await supportRecordsCol()).updateMany(
    { caseId, verification: "pending" },
    { $set: { verification, updatedAt: new Date() } }
  );
}

/** CMs assigned to a community (active, exactly one → unambiguous). */
export async function onlyCmOf(settlementCode: string): Promise<UserDoc | null> {
  const cms = await (await usersCol())
    .find({ role: "cm", active: { $ne: false }, communities: settlementCode })
    .toArray();
  return cms.length === 1 ? cms[0] : null;
}

export { settlementsCol };
