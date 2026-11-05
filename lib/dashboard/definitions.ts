import { casesCol, surveysCol, usersCol } from "@/lib/models";
import { buildSurveyFilter } from "@/lib/surveys";
import { buildCaseFilter, parseCaseQuery } from "@/lib/cases/query";
import type { UserDoc } from "@/lib/models";

/**
 * One definition for every figure that more than one page shows. The
 * programme dashboard, the weekly / monthly dashboard, the case overview and
 * the community list all read these, so the same word never means two numbers.
 *
 *  - A household is "surveyed" when its survey is COMPLETE. Partial surveys are
 *    still being filled in; no case is made and nothing is pushed to Frappe
 *    until they are complete.
 *  - "Urgent / high priority" is priority urgent OR high, everywhere.
 *  - People counts (children, youth, women, elderly, disability) come from the
 *    household member list, the same list the cases and the Frappe push use.
 */

export const TARGET_HOUSEHOLDS = 1600;
export const HIGH_PRIORITY = "urgent,high";

/** Query flags that make every survey count / link use complete surveys only. */
export const COMPLETE_FLAG = "status=complete";

const asDirector = { _id: undefined, role: "director" } as unknown as UserDoc;

/** Survey filter for a count or a link, always complete surveys. Extra flags are ANDed. */
export function completeSurveyFilter(flags = ""): Record<string, unknown> {
  const p = new URLSearchParams(flags);
  p.set("status", "complete");
  return buildSurveyFilter(asDirector, p);
}

export async function countCompleteSurveys(flags = ""): Promise<number> {
  const surveys = await surveysCol();
  return surveys.countDocuments(completeSurveyFilter(flags));
}

/** Surveys that exist but are not complete yet (partial / refused midway). */
export async function countIncompleteSurveys(): Promise<number> {
  const surveys = await surveysCol();
  return surveys.countDocuments({ status: { $ne: "complete" } });
}

/** Active mobilisers (CMs) — the denominator for "mobilisers active". */
export async function countActiveMobilisers(): Promise<number> {
  const users = await usersCol();
  return users.countDocuments({ role: "cm", active: { $ne: false } });
}

export interface TargetGroups {
  children_0_3: number;
  children_4_12: number;
  youth: number;
  women: number;
  elderly: number;
}

/**
 * People in the target groups, counted from the member list of each complete
 * survey (age, and gender for women 15–49). Matches what the cases, the
 * disability figures and the Frappe push are built from.
 */
export async function countTargetGroups(match: Record<string, unknown> = {}): Promise<TargetGroups> {
  const surveys = await surveysCol();
  const age = { $convert: { input: "$members.member_age", to: "int", onError: -1, onNull: -1 } };
  const rows = await surveys
    .aggregate([
      { $match: { ...completeSurveyFilter(), ...match } },
      { $unwind: "$members" },
      { $addFields: { _age: age } },
      {
        $group: {
          _id: null,
          children_0_3: { $sum: { $cond: [{ $and: [{ $gte: ["$_age", 0] }, { $lte: ["$_age", 3] }] }, 1, 0] } },
          children_4_12: { $sum: { $cond: [{ $and: [{ $gte: ["$_age", 4] }, { $lte: ["$_age", 12] }] }, 1, 0] } },
          youth: { $sum: { $cond: [{ $and: [{ $gte: ["$_age", 13] }, { $lte: ["$_age", 24] }] }, 1, 0] } },
          women: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ["$members.member_gender", "female"] },
                    { $gte: ["$_age", 15] },
                    { $lte: ["$_age", 49] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          elderly: { $sum: { $cond: [{ $gte: ["$_age", 60] }, 1, 0] } },
        },
      },
    ])
    .toArray();
  const r = rows[0] || {};
  return {
    children_0_3: (r.children_0_3 as number) || 0,
    children_4_12: (r.children_4_12 as number) || 0,
    youth: (r.youth as number) || 0,
    women: (r.women as number) || 0,
    elderly: (r.elderly as number) || 0,
  };
}

type CaseActor = Pick<UserDoc, "_id" | "role">;

/**
 * Count cases for a link: the module and the filter string the link opens.
 * Same filter builder as the list, so the number and the page cannot differ.
 */
export async function countCasesFor(user: CaseActor, query: string, module?: string): Promise<number> {
  const params = new URLSearchParams(query);
  if (module && module !== "all") params.set("module", module);
  const cases = await casesCol();
  return cases.countDocuments(await buildCaseFilter(user, parseCaseQuery(params)));
}

/** Distinct households with at least one open case. */
export async function countFollowupHouseholds(): Promise<number> {
  const cases = await casesCol();
  const r = await cases
    .aggregate([{ $match: { closed: false } }, { $group: { _id: "$householdId" } }, { $count: "n" }])
    .toArray();
  return (r[0]?.n as number) || 0;
}
