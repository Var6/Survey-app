import { ObjectId, type Filter } from "mongodb";
import { HttpError } from "./api";
import type { UserDoc, VisitRecordDoc, VisitedType } from "./models";
import { clip } from "./schedule";
import { isDateStr } from "./time";

export const VISITED_TYPES: { key: VisitedType; label: string; hi: string }[] = [
  { key: "school", label: "School", hi: "स्कूल" },
  { key: "anganwadi", label: "Anganwadi", hi: "आंगनवाड़ी" },
  { key: "health", label: "Health facility", hi: "स्वास्थ्य केंद्र / डॉक्टर" },
];

export const visitedTypeLabel = (k: string) => VISITED_TYPES.find((t) => t.key === k)?.label ?? k;

export function parseVisitedType(v: unknown): VisitedType {
  const t = VISITED_TYPES.find((x) => x.key === v);
  if (!t) throw new HttpError(400, "Choose what was visited: School, Anganwadi or Health facility");
  return t.key;
}

/** The contact fields each kind of visit asks for. Everything else is dropped. */
export type ContactField =
  | "schoolName" | "principalName" | "principalPhone"
  | "ashaName" | "ashaPhone" | "anmName" | "anmPhone"
  | "facilityName" | "doctorName" | "doctorPhone";
export type Contacts = Partial<Record<ContactField, string>>;
export const CONTACT_FIELDS: Record<VisitedType, ContactField[]> = {
  school: ["schoolName", "principalName", "principalPhone"],
  anganwadi: ["ashaName", "ashaPhone", "anmName", "anmPhone"],
  health: ["facilityName", "doctorName", "doctorPhone"],
};
const ALL_CONTACT_FIELDS: ContactField[] = [...new Set(Object.values(CONTACT_FIELDS).flat())];
const PHONE_FIELDS = new Set<string>(["principalPhone", "ashaPhone", "anmPhone", "doctorPhone"]);

/** Phone numbers are free text on the old form ("N/a", "+91 99344 93889"): keep what was typed, trimmed. */
export function cleanContact(body: Record<string, unknown>, type: VisitedType) {
  const out: Contacts = {};
  for (const k of CONTACT_FIELDS[type]) {
    const v = clip(body[k], PHONE_FIELDS.has(k) ? 30 : 200);
    if (v) out[k] = v;
  }
  return out;
}

export function checkVisitDate(v: unknown, today: string): string {
  const d = clip(v, 10);
  if (!isDateStr(d)) throw new HttpError(400, "Choose the date of the visit");
  if (d > today) throw new HttpError(400, "The visit date cannot be in the future");
  return d;
}

export function cleanDiscussion(v: unknown): string {
  const t = clip(v, 8000);
  if (t.length < 3) throw new HttpError(400, "Write what was discussed");
  return t;
}

/** A contact the visit type needs, for the errors the form shows. */
export function requireContacts(type: VisitedType, c: Contacts) {
  if (type === "school" && !c.schoolName) throw new HttpError(400, "Write the name of the school");
  if (type === "anganwadi" && !c.ashaName && !c.anmName) {
    throw new HttpError(400, "Write the name of the ASHA or the ANM you met");
  }
  if (type === "health" && !c.doctorName && !c.facilityName) {
    throw new HttpError(400, "Write the name of the doctor or the health facility");
  }
}

export { ALL_CONTACT_FIELDS };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One filter for the list, the summary and the exports. A CM only ever sees their own. */
export function buildVisitFilter(
  user: Pick<UserDoc, "_id" | "role">,
  p: URLSearchParams
): Filter<VisitRecordDoc> {
  const and: Filter<VisitRecordDoc>[] = [];
  if (user.role === "cm") and.push({ cmId: user._id });
  const type = p.get("type");
  if (type) and.push({ visitedType: type as VisitedType });
  const from = p.get("from");
  const to = p.get("to");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) and.push({ visitDate: { $gte: from } });
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) and.push({ visitDate: { $lte: to } });
  const settlement = p.get("settlement");
  if (settlement) and.push({ settlementCode: settlement });
  const cm = p.get("cm");
  if (cm && user.role !== "cm") {
    try {
      and.push({ cmId: new ObjectId(cm) });
    } catch {
      /* ignore a malformed id */
    }
  }
  if (p.get("evidence") === "missing") and.push({ photoLinks: { $size: 0 } });
  const q = (p.get("q") || "").trim();
  if (q) {
    const re = { $regex: escapeRe(q), $options: "i" };
    and.push({
      $or: [
        { discussion: re }, { remarks: re }, { communityName: re }, { cmName: re }, { stakeholderNames: re },
        { schoolName: re }, { principalName: re }, { ashaName: re }, { anmName: re }, { doctorName: re }, { facilityName: re },
      ],
    });
  }
  return and.length ? { $and: and } : {};
}
