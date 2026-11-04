import type { CaseDoc, SupportRecordDoc } from "@/lib/models";
import { supportTypesFor } from "./schema";

/**
 * Is this case really finished, judging by the support records linked to it?
 *
 *  - A household "documents" case lists the certificates it needs (caste,
 *    income, residence …). It is finished only when EVERY listed document has a
 *    Complete record. A listed document the form cannot evidence (voter ID,
 *    school papers …) keeps it open.
 *  - Any other case (Ayushman, bank account, Aadhaar …) is finished when one
 *    Complete record of that kind exists.
 */
export interface Verdict {
  close: boolean;
  /** Documents / support shown complete. */
  have: string[];
  /** What is still missing. */
  need: string[];
  /** Latest date of a Complete record. */
  on: string;
  followUpOpen: boolean;
}

type Rec = Pick<SupportRecordDoc, "status" | "supportTypes" | "supportDate">;

export function evaluateCase(c: Pick<CaseDoc, "subcategory" | "meta">, recs: Rec[]): Verdict {
  const types = supportTypesFor("entitlements");
  const complete = recs.filter((r) => r.status === "complete");
  const mine = (t: string) => types.find((x) => x.key === t);
  const docs = new Set<string>();
  let anyOfKind = false;
  for (const r of complete)
    for (const t of r.supportTypes) {
      const d = mine(t);
      if (d?.subcategory !== c.subcategory) continue;
      anyOfKind = true;
      if (d.doc) docs.add(d.doc);
    }
  const on = complete.map((r) => r.supportDate).sort().slice(-1)[0] || "";
  const followUpOpen = recs.some((r) => r.status === "follow_up_required");

  if (c.subcategory === "other_documents") {
    const required = ((c.meta?.docs as string[] | undefined) || []).filter(Boolean);
    const need = required.filter((d) => !docs.has(d));
    return { close: required.length ? need.length === 0 : docs.size > 0, have: [...docs], need, on, followUpOpen };
  }
  return { close: anyOfKind, have: anyOfKind ? [c.subcategory] : [], need: anyOfKind ? [] : [c.subcategory], on, followUpOpen };
}
