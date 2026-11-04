import { ObjectId, type Filter } from "mongodb";
import type { SupportRecordDoc, UserDoc } from "@/lib/models";

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** One filter for the list, summary, report and exports. A CM only ever sees their own records. */
export function buildSupportFilter(
  user: Pick<UserDoc, "_id" | "role">,
  p: URLSearchParams
): Filter<SupportRecordDoc> {
  const and: Filter<SupportRecordDoc>[] = [];
  if (user.role === "cm") and.push({ cmId: user._id });
  const from = p.get("from");
  const to = p.get("to");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) and.push({ supportDate: { $gte: from } });
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) and.push({ supportDate: { $lte: to } });
  const eq = (k: string, f: keyof SupportRecordDoc) => {
    const v = p.get(k);
    if (v) and.push({ [f]: v } as Filter<SupportRecordDoc>);
  };
  eq("settlement", "settlementCode");
  eq("referral", "referral");
  eq("status", "status");
  eq("link", "linkStatus");
  eq("verification", "verification");
  const caseId = p.get("case");
  if (caseId) {
    try {
      and.push({ caseId: new ObjectId(caseId) });
    } catch {
      /* ignore a malformed id */
    }
  }
  const type = p.get("type");
  if (type) and.push({ supportTypes: type });
  const cm = p.get("cm");
  if (cm && user.role !== "cm") {
    if (cm === "none") and.push({ cmId: null } as unknown as Filter<SupportRecordDoc>);
    else {
      try {
        and.push({ cmId: new ObjectId(cm) });
      } catch {
        /* ignore */
      }
    }
  }
  const q = (p.get("q") || "").trim();
  if (q) {
    const re = { $regex: escapeRe(q), $options: "i" };
    and.push({ $or: [{ beneficiaryName: re }, { phone: re }, { remarks: re }, { caseCode: re }, { cmName: re }, { communityName: re }] });
  }
  return and.length ? { $and: and } : {};
}
