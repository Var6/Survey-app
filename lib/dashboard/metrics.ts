import { casesCol, surveysCol } from "@/lib/models";
import { SETTLEMENT_BY_CODE } from "@/lib/questionnaire/settlements";
import { MODULE_LIST } from "@/lib/cases/modules";
import { classifyMaternalCases } from "@/lib/cases/store";
import { buildSurveyFilter } from "@/lib/surveys";
import { buildCaseFilter, parseCaseQuery } from "@/lib/cases/query";
import { SEGMENTS } from "@/lib/cases/segments";
import type { UserDoc } from "@/lib/models";

/**
 * Programme dashboard.
 *
 * Every case tile is defined by a *link*: the module and filter string it
 * opens. The number on the tile is counted with the very same filter builder
 * that the opened page uses, so the tile and the page cannot disagree. (The
 * old dashboard counted raw survey answers while the modules counted cases,
 * which is why the figures differed.)
 */

export interface Tile {
  key: string;
  label: string;
  value: number;
  hint?: string;
  tone?: "normal" | "warn" | "alert";
  /** Module page to open ("all" = every module). Omitted = not clickable. */
  module?: string;
  /** Filter query string for that page. */
  query?: string;
}

export interface DashboardMetrics {
  householdsSurveyed: { count: number; target: number; percent: number };
  /** Distinct households with at least one open case. */
  householdsFollowup: number;
  /** Case-based, clickable tiles. */
  tiles: Tile[];
  /** Survey-based figures that have no case module behind them. */
  pwd: { total: number; children: number; adults: number; households: number };
  directorIntervention: number;
  /** Open maternal cases created before the pregnant / newborn split. */
  maternalUnclassified: number;
  /** Open case load per module (donut + legend), clickable. */
  needsByCategory: { key: string; label: string; value: number; module: string }[];
  /** Surveys per settlement (for the settlement bar chart). */
  bySettlement: { code: string; label: string; value: number }[];
}

type Actor = Pick<UserDoc, "_id" | "role">;

export async function computeDashboardMetrics(user: Actor): Promise<DashboardMetrics> {
  const surveys = await surveysCol();
  const cases = await casesCol();

  // Maternal cases created before the pregnant / newborn split have no group
  // yet, which made both tiles read 0. Sort them once, automatically.
  try {
    await classifyMaternalCases();
  } catch (e) {
    console.error("[dashboard] could not classify maternal cases:", e);
  }
  const surveyUser = { _id: user._id, role: "director" } as never;
  const surveyCount = (flags: string) =>
    surveys.countDocuments(buildSurveyFilter(surveyUser, new URLSearchParams(flags)));

  /**
   * Count cases for a link — identical logic to the list the link opens. The
   * module is part of the link, so it must be part of the count too.
   */
  const count = async (query: string, module?: string) => {
    const params = new URLSearchParams(query);
    if (module && module !== "all") params.set("module", module);
    return cases.countDocuments(await buildCaseFilter(user, parseCaseQuery(params)));
  };

  const tileDefs: Omit<Tile, "value">[] = [
    { key: "open", label: "Open action cases", module: "all", query: "status=open" },
    {
      key: "urgent",
      label: "Urgent / high priority",
      module: "all",
      query: "status=open&priority=urgent,high",
      tone: "warn",
    },
    { key: "overdue", label: "Overdue follow-ups", module: "all", query: "status=overdue", tone: "alert" },
    {
      key: "review",
      label: "Closure requests awaiting review",
      module: "all",
      query: "status=open&closure=pending",
      tone: "warn",
    },
    {
      key: "out_of_school",
      label: "Out-of-school children",
      module: "education",
      query: "status=open&segment=out_of_school",
      tone: "warn",
    },
    {
      key: "dropout",
      label: "Dropout children",
      module: "education",
      query: "status=open&segment=dropout",
      tone: "warn",
    },
    {
      key: "pregnant",
      label: "Pregnant women",
      module: "maternal",
      query: "status=open&segment=pregnant",
    },
    {
      key: "newborn_mother",
      label: "Mothers with newborn",
      module: "maternal",
      query: "status=open&segment=newborn_mother",
    },
    {
      key: "pending_docs",
      label: "Pending social security & docs",
      module: "entitlements",
      query: "status=open",
    },
  ];

  const [
    householdsSurveyed,
    tileValues,
    maternalUnclassified,
    householdAgg,
    moduleAgg,
    pwdAgg,
    settlementAgg,
    directorIntervention,
    pwdHouseholds,
  ] = await Promise.all([
    surveys.countDocuments({}),
    Promise.all(tileDefs.map((t) => count(t.query!, t.module))),
    count("status=open&segment=maternal_unspecified", "maternal"),
    cases
      .aggregate([
        { $match: { closed: false } },
        { $group: { _id: "$householdId" } },
        { $count: "n" },
      ])
      .toArray(),
    cases
      .aggregate([
        { $match: { closed: false } },
        { $group: { _id: "$module", n: { $sum: 1 } } },
      ])
      .toArray(),
    surveys
      .aggregate([
        {
          $project: {
            pwd: {
              $filter: {
                input: { $ifNull: ["$members", []] },
                as: "m",
                cond: { $in: ["$$m.member_disability", ["yes_cert", "yes_no_cert"]] },
              },
            },
          },
        },
        {
          $project: {
            total: { $size: "$pwd" },
            children: {
              $size: {
                $filter: {
                  input: "$pwd",
                  as: "m",
                  cond: {
                    $lt: [
                      { $convert: { input: "$$m.member_age", to: "int", onError: 99, onNull: 99 } },
                      18,
                    ],
                  },
                },
              },
            },
          },
        },
        { $group: { _id: null, total: { $sum: "$total" }, children: { $sum: "$children" } } },
      ])
      .toArray(),
    surveys
      .aggregate([
        { $group: { _id: "$settlementCode", value: { $sum: 1 } } },
        { $sort: { value: -1 } },
      ])
      .toArray(),
    // Escalated to the Director — a survey flag, counted with the same
    // filter as the survey list the tile opens.
    surveyCount("escalated=1"),
    surveyCount("pwd=1"),
  ]);

  const tiles: Tile[] = tileDefs.map((t, i) => ({ ...t, value: tileValues[i] }));
  const pwdTotal = (pwdAgg[0]?.total as number) || 0;
  const pwdChildren = (pwdAgg[0]?.children as number) || 0;

  const openByModule = new Map(moduleAgg.map((m) => [m._id as string, m.n as number]));
  const needsByCategory = MODULE_LIST.map((m) => ({
    key: m.key,
    label: m.short,
    value: openByModule.get(m.key) || 0,
    module: m.key,
  }));

  const bySettlement = settlementAgg.map((s) => {
    const code = (s._id as string) || "unknown";
    return {
      code,
      label: SETTLEMENT_BY_CODE[code]?.label || code,
      value: s.value as number,
    };
  });

  return {
    householdsSurveyed: {
      count: householdsSurveyed,
      target: 1600,
      percent: Math.round((householdsSurveyed / 1600) * 100),
    },
    householdsFollowup: (householdAgg[0]?.n as number) || 0,
    tiles,
    pwd: {
      total: pwdTotal,
      children: pwdChildren,
      adults: pwdTotal - pwdChildren,
      households: pwdHouseholds,
    },
    directorIntervention,
    maternalUnclassified,
    needsByCategory,
    bySettlement,
  };
}

export { SEGMENTS };
