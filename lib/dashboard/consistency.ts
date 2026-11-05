import { casesCol, surveysCol } from "@/lib/models";
import { computeDashboardMetrics } from "./metrics";
import { computeDashboard } from "@/lib/weekly/dashboard";
import {
  completeSurveyFilter,
  countCasesFor,
  countCompleteSurveys,
  countFollowupHouseholds,
  countTargetGroups,
} from "./definitions";
import { MODULE_LIST } from "@/lib/cases/modules";
import { settlementLabels } from "@/lib/settlements";

/**
 * Cross-checks: the same fact counted by two different routes must agree.
 * Run from the API (director / MIS / PM) and by the test suite, so a number
 * that drifts apart shows up as a failed check instead of a confused team.
 */
export interface Check {
  name: string;
  a: { label: string; value: number };
  b: { label: string; value: number };
  ok: boolean;
}

export interface ConsistencyReport {
  ok: boolean;
  checks: Check[];
  /** Not an error in the app: households where the typed head-counts differ from the member list. */
  dataQuality: { headcountMismatchHouseholds: number; partialSurveys: number };
}

export async function runConsistencyChecks(): Promise<ConsistencyReport> {
  const director = { _id: undefined, role: "director" } as never;
  const [m, w, surveys, cases, labels] = await Promise.all([
    computeDashboardMetrics(director),
    computeDashboard(new Date("2000-01-01"), new Date()),
    surveysCol(),
    casesCol(),
    settlementLabels(),
  ]);
  void labels;
  const checks: Check[] = [];
  const check = (name: string, a: [string, number], b: [string, number]) =>
    checks.push({ name, a: { label: a[0], value: a[1] }, b: { label: b[0], value: b[1] }, ok: a[1] === b[1] });

  const completeList = await countCompleteSurveys();
  check("Households surveyed", ["Dashboard", m.householdsSurveyed.count], ["Survey list (complete)", completeList]);
  check("Households surveyed", ["Dashboard", m.householdsSurveyed.count], ["Weekly / monthly dashboard", w.householdsCumulative]);
  check(
    "Households surveyed",
    ["Dashboard", m.householdsSurveyed.count],
    ["Sum over communities (dashboard bars)", m.bySettlement.reduce((s, x) => s + x.value, 0)]
  );
  check(
    "Households surveyed",
    ["Dashboard", m.householdsSurveyed.count],
    ["Sum over communities (weekly bars)", w.settlementSplit.reduce((s, x) => s + x.cumulative, 0)]
  );

  const openAll = await countCasesFor(director, "status=open");
  const openTile = m.tiles.find((t) => t.key === "open")!.value;
  check("Open cases", ["Dashboard tile", openTile], ["Case list (all modules)", openAll]);
  check("Open cases", ["Dashboard tile", openTile], ["Sum of module bars", m.needsByCategory.reduce((s, x) => s + x.value, 0)]);
  check("Open cases", ["Dashboard tile", openTile], ["Cases not closed (database)", await cases.countDocuments({ closed: false })]);
  const perModule = await Promise.all(MODULE_LIST.map((mod) => countCasesFor(director, "status=open", mod.key)));
  check("Open cases", ["Dashboard tile", openTile], ["Sum of the module lists", perModule.reduce((s, x) => s + x, 0)]);

  const tile = (k: string) => m.tiles.find((t) => t.key === k)!.value;
  check("Pregnant women", ["Dashboard", tile("pregnant")], ["Weekly / monthly dashboard", w.pregnantWomen]);
  check("Mothers with newborn", ["Dashboard", tile("newborn_mother")], ["Weekly / monthly dashboard", w.mothersWithNewborn]);
  check(
    "Maternal cases",
    ["Maternal module", await countCasesFor(director, "status=open", "maternal")],
    ["Pregnant + newborn + not classified", tile("pregnant") + tile("newborn_mother") + m.maternalUnclassified]
  );
  check("Households needing follow-up", ["Dashboard", m.householdsFollowup], ["Weekly / monthly dashboard", w.followupHouseholds]);
  check("Households needing follow-up", ["Dashboard", m.householdsFollowup], ["Distinct households with an open case", await countFollowupHouseholds()]);
  check("Households with a person with disability", ["Dashboard", m.pwd.households], ["Weekly / monthly dashboard", w.pwd]);
  check("Entitlement cases open", ["Dashboard (pending docs)", tile("pending_docs")], ["Weekly / monthly dashboard", w.entitlementGaps]);

  const groups = await countTargetGroups();
  check("Children 0–3", ["Weekly / monthly dashboard", w.targets.children_0_3], ["Member list", groups.children_0_3]);
  check("Women 15–49", ["Weekly / monthly dashboard", w.targets.women], ["Member list", groups.women]);

  // Informational: typed head-counts vs the member list, per household.
  const mismatch = await surveys
    .aggregate([
      { $match: completeSurveyFilter() },
      {
        $project: {
          typed: {
            $add: [
              { $convert: { input: "$data.num_children_0_3", to: "int", onError: 0, onNull: 0 } },
              { $convert: { input: "$data.num_children_4_12", to: "int", onError: 0, onNull: 0 } },
              { $convert: { input: "$data.num_youth_13_24", to: "int", onError: 0, onNull: 0 } },
            ],
          },
          ages: {
            $map: {
              input: { $ifNull: ["$members", []] },
              as: "x",
              in: { $convert: { input: "$$x.member_age", to: "int", onError: -1, onNull: -1 } },
            },
          },
        },
      },
      {
        $project: {
          typed: 1,
          roster: {
            $size: { $filter: { input: "$ages", as: "a", cond: { $and: [{ $gte: ["$$a", 0] }, { $lte: ["$$a", 24] }] } } },
          },
        },
      },
      { $match: { $expr: { $ne: ["$typed", "$roster"] } } },
      { $count: "n" },
    ])
    .toArray();

  return {
    ok: checks.every((c) => c.ok),
    checks,
    dataQuality: {
      headcountMismatchHouseholds: (mismatch[0]?.n as number) || 0,
      partialSurveys: m.householdsSurveyed.incomplete,
    },
  };
}
