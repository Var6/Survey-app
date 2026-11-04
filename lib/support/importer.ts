import crypto from "crypto";
import { ObjectId } from "mongodb";
import {
  casesCol,
  supportRecordsCol,
  usersCol,
  ensureIndexes,
  type CaseDoc,
  type SupportRecordDoc,
} from "@/lib/models";
import { parseCsv } from "@/lib/csv";
import { parseLinks } from "@/lib/meeting-records";
import { audit } from "@/lib/audit";
import { REFERRAL_BY_KEY, parseDocumentTypes, supportTypesFor, typeLabels } from "./schema";
import { matchRecord } from "./match";
import { closeCaseDirect, cleanPhone, onlyCmOf } from "./service";
import { evaluateCase } from "./evidence";
import { settlementLabels } from "@/lib/settlements";

/**
 * Bring the old "Community Support & Follow-up (Document Supports)" Google
 * Sheet into the app.
 *
 * The sheet has no case id, so every row is matched by COMMUNITY, then the
 * BENEFICIARY'S NAME against the household head and members surveyed in that
 * community, then an OPEN case of the right kind in that household:
 *
 *   exactly one household, exact name, open case → linked, and the case is
 *     closed if the sheet shows everything it needed as Complete
 *   close spelling, or several households        → suggested (a person confirms)
 *   nothing close                                → kept as an unlinked record
 *
 * Nothing is closed on a guess, and every row is kept either way.
 */

const COMMUNITY: Record<string, string> = {
  "raza tola": "ambedkar_nagar", // read as Raja Tola / Ambedkar Nagar
  "anupnagar": "dhangar_tola",
  "anup nagar": "dhangar_tola",
  "shree ram tola": "khatal_patti",
  "loot maholla": "loot_mohalla",
  "loot mohalla": "loot_mohalla",
  "baxaghat": "buxa_ghat",
  "rajendranagar": "maha_dalit_tola",
  "kalijaan": "singhia_tola", // "Kalijaan" alone = Kalijaan 2 / Singhia Tola
  "naya kalijaan tola": "kalijaan_naya_tola",
  "housing board": "refugee_colony",
  "bargeshnagar": "damka_tola",
  "shanti kabar": "shanti_kabra",
  "kheruganj": "kheruganj",
};

const mdy = (s: string) => {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const [mo, d, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
};

export interface ImportReport {
  rows: number;
  valid: number;
  alreadyImported: number;
  toAdd: number;
  problems: string[];
  warnings: string[];
  linked: number;
  suggested: number;
  unlinked: number;
  casesToClose: { caseCode: string; household: string; docs: string; on: string }[];
  casesPartial: { caseCode: string; household: string; have: string; need: string }[];
  withCm: number;
  withoutCm: number;
  cmByName: Record<string, number>;
  byCommunity: Record<string, { rows: number; linked: number; suggested: number; unlinked: number }>;
  suggestionSamples: string[];
  applied?: { inserted: number; closed: number; progressNotes: number };
}

interface Prepared {
  doc: SupportRecordDoc;
  matchedCase?: CaseDoc;
  row: number;
}

export async function importSupportSheet(csvText: string, opts: { apply: boolean; by?: string }): Promise<ImportReport> {
  await ensureIndexes();
  const table = parseCsv(csvText.replace(/^﻿/, ""));
  const headIdx = table.findIndex((r) => /^si\.?\s*no/i.test((r[0] || "").trim()));
  if (headIdx < 0) throw new Error("Could not find the header row (SI.No, Date, Community Name …)");
  const body = table.slice(headIdx + 1);

  const report: ImportReport = {
    rows: body.length, valid: 0, alreadyImported: 0, toAdd: 0, problems: [], warnings: [],
    linked: 0, suggested: 0, unlinked: 0, casesToClose: [], casesPartial: [], withCm: 0, withoutCm: 0, cmByName: {},
    byCommunity: {}, suggestionSamples: [],
  };
  const labels = await settlementLabels();
  const users = await usersCol();
  const cmCache = new Map<string, { id: ObjectId; name: string } | null>();
  const cmOfCommunity = async (code: string) => {
    if (!cmCache.has(code)) {
      const u = await onlyCmOf(code);
      cmCache.set(code, u ? { id: u._id!, name: u.name } : null);
    }
    return cmCache.get(code)!;
  };

  const prepared: Prepared[] = [];
  const keys = new Set<string>();
  for (const [i, r] of body.entries()) {
    const line = headIdx + i + 2;
    const commRaw = (r[2] || "").trim();
    const code = COMMUNITY[commRaw.toLowerCase().replace(/\s+/g, " ")];
    const date = mdy(r[1] || "");
    const name = (r[4] || "").trim().replace(/\s+/g, " ");
    if (!code || !labels[code]) { report.problems.push(`row ${line}: community “${commRaw}” is not a known community`); continue; }
    if (!date) { report.problems.push(`row ${line}: bad date “${r[1]}”`); continue; }
    if (name.length < 2) { report.problems.push(`row ${line}: no beneficiary name`); continue; }
    const referral = REFERRAL_BY_KEY.entitlements; // this sheet is the Document Support tab
    const { keys: typeKeys, unknown } = parseDocumentTypes(r[6] || "");
    if (!typeKeys.length) { report.problems.push(`row ${line}: type of support “${r[6]}” not recognised`); continue; }
    if (unknown.length) report.warnings.push(`row ${line}: ignored unrecognised support type(s): ${unknown.join(", ")}`);

    const statusRaw = (r[8] || "").trim().toLowerCase();
    const status: SupportRecordDoc["status"] = statusRaw === "complete" ? "complete" : "follow_up_required";
    if (!statusRaw) report.warnings.push(`row ${line}: status blank — treated as follow-up required (nothing is closed on it)`);

    let photoLinks: string[] = [];
    try { photoLinks = parseLinks(r[7] || "", "Photo"); } catch { report.warnings.push(`row ${line}: photo link not a Google Drive link — left out`); }
    const remarksRaw = (r[9] || "").trim();
    const remarks = /^(na|n\/a|nil|-)$/i.test(remarksRaw) ? undefined : remarksRaw || undefined;

    const importKey = crypto.createHash("sha1").update(["support", r[0], r[1], commRaw, name, r[6]].join("|")).digest("hex").slice(0, 24);
    if (keys.has(importKey)) { report.problems.push(`row ${line}: duplicate of an earlier row`); continue; }
    keys.add(importKey);

    const m = await matchRecord({ settlementCode: code, referral: referral.key, beneficiaryName: name, typeKeys });
    const when = new Date(`${date}T12:00:00+05:30`);
    const doc: SupportRecordDoc = {
      supportDate: date, settlementCode: code, communityName: labels[code], referral: referral.key, referralLabel: referral.label,
      beneficiaryName: name, phone: cleanPhone(r[5]), supportTypes: typeKeys, supportTypeLabels: typeLabels(referral.key, typeKeys),
      details: {}, photoLinks, status, remarks,
      linkStatus: m.linkStatus, ...(m.suggestions.length ? { suggestions: m.suggestions } : {}),
      verification: "not_needed", source: "import", importKey, submittedAt: when,
      history: [{ at: new Date(), by: opts.by || "Import", note: `Imported from the Google Sheet (row ${r[0] || line})` }],
      createdAt: when, updatedAt: new Date(),
    };
    if (m.linkStatus === "linked" && m.case) {
      doc.caseId = m.case._id; doc.caseCode = m.case.caseId; doc.householdId = m.case.householdId;
    }
    // CM: the one who surveyed the matched household, else the community's only CM.
    const ownerId = m.case?.assignedCmId ?? m.case?.mobiliserId;
    let cm = ownerId ? await users.findOne({ _id: ownerId }, { projection: { name: 1 } }).then((u) => (u ? { id: u._id!, name: u.name } : null)) : null;
    if (!cm) cm = await cmOfCommunity(code);
    if (cm) { doc.cmId = cm.id; doc.cmName = cm.name; doc.cmInferred = true; report.withCm++; report.cmByName[cm.name] = (report.cmByName[cm.name] || 0) + 1; } else report.withoutCm++;

    prepared.push({ doc, matchedCase: m.case, row: line });
    const bc = (report.byCommunity[labels[code]] ||= { rows: 0, linked: 0, suggested: 0, unlinked: 0 });
    bc.rows++;
    bc[m.linkStatus]++;
    report[m.linkStatus]++;
    if (m.linkStatus === "suggested" && report.suggestionSamples.length < 12) {
      report.suggestionSamples.push(`${labels[code]} · ${name} → ${m.suggestions.map((s) => `${s.name} (${s.householdId}, ${Math.round(s.score * 100)}%)`).join(" | ")}`);
    }
  }
  report.valid = prepared.length;

  const col = await supportRecordsCol();
  const existing = new Set(
    (await col.find({ importKey: { $in: [...keys] } }, { projection: { importKey: 1 } }).toArray()).map((d) => d.importKey as string)
  );
  report.alreadyImported = existing.size;
  const fresh = prepared.filter((p) => !existing.has(p.doc.importKey!));
  report.toAdd = fresh.length;

  /* Decide, per matched case, whether the sheet shows it finished. */
  const byCase = new Map<string, { c: CaseDoc; recs: SupportRecordDoc[] }>();
  for (const p of prepared) {
    if (!p.matchedCase) continue;
    const k = String(p.matchedCase._id);
    (byCase.get(k) || byCase.set(k, { c: p.matchedCase, recs: [] }).get(k)!).recs.push(p.doc);
  }
  const verdicts: { c: CaseDoc; close: boolean; on: string; docs: string; have: string; need: string; followUp: boolean }[] = [];
  for (const { c, recs } of byCase.values()) {
    // Also count Complete records of this case from an earlier run.
    const earlier = await col.find({ caseId: c._id, source: "import", importKey: { $nin: [...keys].filter((k) => !existing.has(k)) } }).toArray();
    const v = evaluateCase(c, [...recs, ...earlier.filter((e) => !recs.some((r) => r.importKey === e.importKey))]);
    const have = v.have.join(", ");
    verdicts.push({ c, close: v.close, on: v.on, docs: have, have, need: v.need.join(", "), followUp: v.followUpOpen });
    if (v.close) report.casesToClose.push({ caseCode: c.caseId, household: c.householdId, docs: have, on: v.on });
    else report.casesPartial.push({ caseCode: c.caseId, household: c.householdId, have: have || "none complete", need: v.need.join(", ") || "follow-up required in sheet" });
  }

  if (!opts.apply) return report;

  /* Apply: records first, then the cases they finish. */
  const ops = fresh.map((p) => {
    const d = { ...p.doc, verification: (p.doc.status === "complete" && p.doc.linkStatus === "linked" ? "verified" : "not_needed") as SupportRecordDoc["verification"] };
    return { updateOne: { filter: { importKey: d.importKey }, update: { $setOnInsert: d }, upsert: true } };
  });
  const res = ops.length ? await col.bulkWrite(ops as never, { ordered: false }) : { upsertedCount: 0 };
  let closed = 0, notes = 0;
  const cases = await casesCol();
  const freshCaseIds = new Set(fresh.filter((p) => p.matchedCase).map((p) => String(p.matchedCase!._id)));
  for (const v of verdicts) {
    if (!freshCaseIds.has(String(v.c._id))) continue; // only act for rows added in this run
    if (v.close) {
      const ok = await closeCaseDirect(v.c, {
        via: "import", by: opts.by || "Import", at: new Date(`${v.on}T12:00:00+05:30`),
        note: `Closed from the Google Sheet (Document Support): ${v.docs} marked Complete (${v.on})`,
      });
      if (ok) { closed++; await audit({ actor: { name: opts.by || "Import", role: "system" }, action: "case.closed_by_import", entityType: "case", entityId: String(v.c._id), ref: v.c.caseId, summary: `Closed from the Google Sheet: ${v.docs}` }); }
    } else {
      const note = `Google Sheet: ${v.have ? `${v.have} done` : "support recorded"}${v.need ? `; still needed: ${v.need}` : ""}${v.followUp ? "; follow-up required" : ""}`;
      const r = await cases.updateOne(
        { _id: v.c._id, closed: false, "history.note": { $ne: note } },
        { $set: { workflowStatus: "follow_up_in_progress", lastFollowupAt: new Date(), updatedAt: new Date() }, $push: { history: { at: new Date(), stage: v.c.stage, note, by: opts.by || "Import" } } } as never
      );
      if (r.modifiedCount) notes++;
    }
  }
  report.applied = { inserted: res.upsertedCount, closed, progressNotes: notes };
  return report;
}

/**
 * Give previously imported Meeting / Camp / Support records a CM, so the CM sees
 * what they submitted: the one active CM assigned to that community. Records of
 * a community with no CM, or several, stay with the office. Marked as inferred.
 */
export async function attributeRecordsToCms(opts: { apply: boolean }) {
  const { meetingRecordsCol } = await import("@/lib/models");
  const out: Record<string, { meetings: number; camps: number; support: number }> = {};
  const skipped: Record<string, number> = {};
  const colM = await meetingRecordsCol();
  const colS = await supportRecordsCol();
  const cache = new Map<string, { id: ObjectId; name: string } | null>();
  const cmOf = async (code: string) => {
    if (!cache.has(code)) { const u = await onlyCmOf(code); cache.set(code, u ? { id: u._id!, name: u.name } : null); }
    return cache.get(code)!;
  };
  for (const [col, key] of [[colM, "m"], [colS, "s"]] as const) {
    const docs = await (col as typeof colM).find({ cmId: { $exists: false }, source: "import" } as never).project({ settlementCode: 1, kind: 1, communityName: 1 }).toArray();
    for (const d of docs as { _id: ObjectId; settlementCode?: string; kind?: string; communityName: string }[]) {
      const cm = d.settlementCode ? await cmOf(d.settlementCode) : null;
      if (!cm) { skipped[d.communityName] = (skipped[d.communityName] || 0) + 1; continue; }
      const bucket = (out[cm.name] ||= { meetings: 0, camps: 0, support: 0 });
      if (key === "s") bucket.support++; else if (d.kind === "camp") bucket.camps++; else bucket.meetings++;
      if (opts.apply) await (col as typeof colM).updateOne({ _id: d._id } as never, { $set: { cmId: cm.id, cmName: cm.name, cmInferred: true } } as never);
    }
  }
  return { perCm: out, leftWithOffice: skipped };
}
