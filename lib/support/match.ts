import { ObjectId } from "mongodb";
import { casesCol, surveysCol, type CaseDoc } from "@/lib/models";
import { supportTypesFor } from "./schema";

/**
 * Work out which open case a support record belongs to when the sheet has no
 * case id: same community, then the beneficiary's name against the household
 * head and every member listed in the survey, then an open case of the right
 * kind in that household.
 *
 * Exact name + exactly one household  → "linked"   (safe to act on)
 * Close but not exact, or several     → "suggested" (a person must confirm)
 * Nothing close                       → "unlinked"
 */

// Spelling variants that mean the same name on the ground.
const ALIAS: Record<string, string> = {
  md: "mohammad", mohd: "mohammad", mo: "mohammad", mohammed: "mohammad",
  muhammad: "mohammad", mohamad: "mohammad", khatun: "khatoon", kr: "kumar", kumari: "kumari",
};

export const nameTokens = (s: string): string[] =>
  s
    .toLowerCase()
    .replace(/[^a-zऀ-ॿ\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ALIAS[t] || t);

function lev(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

/** 1 = same name (any word order); lower = close spelling; 0 = different. */
export function nameScore(a: string, b: string): number {
  const A = nameTokens(a);
  const B = nameTokens(b);
  if (!A.length || !B.length) return 0;
  const used = new Set<number>();
  let hit = 0;
  for (const x of A) {
    let best = -1;
    let bs = 0;
    B.forEach((y, i) => {
      if (used.has(i)) return;
      const s = x === y ? 1 : lev(x, y) <= (x.length > 5 ? 2 : 1) ? 0.8 : 0;
      if (s > bs) {
        bs = s;
        best = i;
      }
    });
    if (best >= 0) {
      used.add(best);
      hit += bs;
    }
  }
  return hit / Math.max(A.length, B.length);
}

export interface Candidate {
  surveyId: ObjectId;
  householdId: string;
  matchedName: string;
  score: number;
}

/** Households in the community whose head or members resemble this name, best first. */
export async function householdCandidates(
  settlementCode: string,
  name: string,
  min = 0.6
): Promise<Candidate[]> {
  const surveys = await (await surveysCol())
    .find(
      { settlementCode },
      { projection: { householdId: 1, "data.head_name": 1, "data.respondent_name": 1, members: 1 } }
    )
    .toArray();
  const out: Candidate[] = [];
  for (const s of surveys) {
    const names = [
      s.data?.head_name,
      s.data?.respondent_name,
      ...((s.members || []) as { member_name?: string }[]).map((m) => m.member_name),
    ].filter((n): n is string => typeof n === "string" && !!n.trim());
    let best = 0;
    let who = "";
    for (const n of names) {
      const sc = nameScore(name, n);
      if (sc > best) {
        best = sc;
        who = n;
      }
    }
    if (best >= min) out.push({ surveyId: s._id!, householdId: s.householdId, matchedName: who.trim(), score: best });
  }
  return out.sort((a, b) => b.score - a.score);
}

export interface Match {
  linkStatus: "linked" | "suggested" | "unlinked";
  /** The case to act on when linked. */
  case?: CaseDoc;
  suggestions: { caseId: string; caseCode: string; householdId: string; name: string; score: number }[];
}

/**
 * Find the open case(s) a record of this referral / support types could belong to.
 * `typeKeys` decide which case subcategories are relevant.
 */
export async function matchRecord(input: {
  settlementCode: string;
  referral: string;
  beneficiaryName: string;
  typeKeys: string[];
}): Promise<Match> {
  const wanted = new Set(
    supportTypesFor(input.referral)
      .filter((t) => input.typeKeys.includes(t.key))
      .map((t) => t.subcategory)
  );
  const cands = await householdCandidates(input.settlementCode, input.beneficiaryName);
  if (!cands.length) return { linkStatus: "unlinked", suggestions: [] };

  const cases = await casesCol();
  const found = await cases
    .find({
      surveyId: { $in: cands.map((c) => c.surveyId) },
      module: input.referral as CaseDoc["module"],
      closed: false,
      ...(wanted.size ? { subcategory: { $in: [...wanted] } } : {}),
    })
    .toArray();
  const bySurvey = new Map<string, CaseDoc[]>();
  for (const k of found) {
    const a = bySurvey.get(String(k.surveyId)) || [];
    a.push(k);
    bySurvey.set(String(k.surveyId), a);
  }

  const withCase = cands.filter((c) => bySurvey.has(String(c.surveyId)));
  const suggestions = withCase.slice(0, 5).map((c) => {
    const k = bySurvey.get(String(c.surveyId))![0];
    return { caseId: String(k._id), caseCode: k.caseId, householdId: c.householdId, name: c.matchedName, score: Math.round(c.score * 100) / 100 };
  });
  if (!withCase.length) return { linkStatus: "unlinked", suggestions: [] };

  const top = withCase[0];
  const sameBest = withCase.filter((c) => c.score === top.score);
  if (top.score === 1 && sameBest.length === 1) {
    return { linkStatus: "linked", case: bySurvey.get(String(top.surveyId))![0], suggestions };
  }
  return { linkStatus: "suggested", suggestions };
}
