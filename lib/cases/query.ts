import { ObjectId, type Filter } from "mongodb";
import {
  casesCol,
  caseClosuresCol,
  usersCol,
  type CaseDoc,
  type UserDoc,
} from "@/lib/models";
import { MODULES, MODULE_LIST } from "./modules";
import {
  SEGMENTS,
  isSegmentKey,
  segmentFilter,
  type SegmentKey,
} from "./segments";
import { WORKFLOW_KEYS } from "./workflow";
import { istToday } from "@/lib/time";

/**
 * ONE definition of "which cases match these filters". The module lists, the
 * dashboard tiles, the facet counts and the CM's own list all go through
 * buildCaseFilter, which is why a tile and the page it opens always agree.
 */

export type CaseStatusFilter = "open" | "closed" | "overdue" | "all";

export interface CaseQuery {
  module?: string;
  segment?: SegmentKey;
  subcategory?: string;
  settlement?: string;
  /** One or more of urgent | high | medium | low. */
  priority?: string[];
  status: CaseStatusFilter;
  workflow: string[];
  closure?: "pending" | "approved" | "rejected";
  followup?: "none" | "submitted";
  cm?: string;
  reviewer?: string;
  from?: string;
  to?: string;
  q?: string;
}

export const PAGE_SIZE_DEFAULT = 100;
export const PAGE_SIZE_MAX = 200;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const oneOf = <T extends string>(v: string | null, allowed: readonly T[]): T | undefined =>
  v && (allowed as readonly string[]).includes(v) ? (v as T) : undefined;

export function parseCaseQuery(p: URLSearchParams): CaseQuery {
  const moduleKey = p.get("module") || undefined;
  const segment = p.get("segment");
  const wf = (p.get("workflow") || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => (WORKFLOW_KEYS as string[]).includes(s));
  return {
    module: moduleKey && moduleKey !== "all" && moduleKey in MODULES ? moduleKey : undefined,
    segment: isSegmentKey(segment) ? segment : undefined,
    subcategory: p.get("subcategory") || undefined,
    settlement: p.get("settlement") || undefined,
    priority: (p.get("priority") || "")
      .split(",")
      .filter((x) => ["urgent", "high", "medium", "low"].includes(x)),
    status: oneOf(p.get("status"), ["open", "closed", "overdue", "all"] as const) ?? "open",
    workflow: wf,
    closure: oneOf(p.get("closure"), ["pending", "approved", "rejected"] as const),
    followup: oneOf(p.get("followup"), ["none", "submitted"] as const),
    cm: p.get("cm") || undefined,
    reviewer: p.get("reviewer") || undefined,
    from: DATE.test(p.get("from") || "") ? p.get("from")! : undefined,
    to: DATE.test(p.get("to") || "") ? p.get("to")! : undefined,
    q: (p.get("q") || "").trim() || undefined,
  };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const todayStr = () => istToday();

function oid(v: string): ObjectId | null {
  try {
    return new ObjectId(v);
  } catch {
    return null;
  }
}

/** Status filter that also understands cases created before the workflow field. */
export function workflowClause(statuses: string[]): Filter<CaseDoc> {
  const or: Filter<CaseDoc>[] = [{ workflowStatus: { $in: statuses } } as Filter<CaseDoc>];
  if (statuses.includes("open")) or.push({ workflowStatus: null, closed: false } as unknown as Filter<CaseDoc>);
  if (statuses.includes("verified_closed"))
    or.push({ workflowStatus: null, closed: true } as unknown as Filter<CaseDoc>);
  return { $or: or } as Filter<CaseDoc>;
}

/** The CM's own cases: assigned to them, or (older cases) surveyed by them. */
export function cmScopeClause(userId: ObjectId): Filter<CaseDoc> {
  return {
    $or: [{ assignedCmId: userId }, { assignedCmId: null, mobiliserId: userId }],
  } as Filter<CaseDoc>;
}

export type Dimension =
  | "module"
  | "segment"
  | "subcategory"
  | "settlement"
  | "priority"
  | "status"
  | "workflow"
  | "followup"
  | "cm";

/**
 * Build the Mongo filter. `omit` leaves one dimension out — used to compute
 * facet counts ("how many cases would match if this filter were cleared").
 */
export async function buildCaseFilter(
  user: Pick<UserDoc, "_id" | "role">,
  q: CaseQuery,
  omit: Dimension[] = []
): Promise<Filter<CaseDoc>> {
  const and: Filter<CaseDoc>[] = [];
  const skip = (d: Dimension) => omit.includes(d);

  if (user.role === "cm") and.push(cmScopeClause(user._id!));

  if (q.module && !skip("module")) and.push({ module: q.module } as Filter<CaseDoc>);
  if (q.segment && !skip("segment")) and.push(segmentFilter(q.segment));
  if (q.subcategory && !skip("subcategory")) and.push({ subcategory: q.subcategory });
  if (q.settlement && !skip("settlement")) and.push({ settlementCode: q.settlement });
  if (q.priority?.length && !skip("priority"))
    and.push({ priority: { $in: q.priority } } as Filter<CaseDoc>);

  if (!skip("status")) {
    if (q.status === "open") and.push({ closed: false });
    else if (q.status === "closed") and.push({ closed: true });
    else if (q.status === "overdue")
      and.push({ closed: false, dueDate: { $gt: "", $lt: todayStr() } });
  }

  if (!skip("workflow")) {
    if (q.workflow.length) and.push(workflowClause(q.workflow));
    if (q.closure) {
      const map = {
        pending: ["closure_requested", "under_review"],
        approved: ["verified_closed"],
        rejected: ["revision_required"],
      } as const;
      and.push(workflowClause([...map[q.closure]]));
    }
  }

  if (q.followup && !skip("followup")) {
    and.push(
      q.followup === "none"
        ? ({ $or: [{ followupCount: null }, { followupCount: 0 }] } as Filter<CaseDoc>)
        : { followupCount: { $gt: 0 } }
    );
  }

  if (q.cm && !skip("cm")) {
    const id = oid(q.cm);
    if (id) and.push(cmScopeClause(id));
  }

  if (q.reviewer) {
    const id = oid(q.reviewer);
    if (id) {
      const closures = await caseClosuresCol();
      const ids = await closures.distinct("caseId", { "decisions.userId": id });
      and.push({ _id: { $in: ids } } as Filter<CaseDoc>);
    }
  }

  // Dates are India calendar days; stored times are UTC instants.
  if (q.from || q.to) {
    const range: Record<string, Date> = {};
    if (q.from) range.$gte = new Date(`${q.from}T00:00:00+05:30`);
    if (q.to) range.$lte = new Date(`${q.to}T23:59:59.999+05:30`);
    and.push({ createdAt: range } as Filter<CaseDoc>);
  }

  if (q.q) {
    const re = { $regex: escapeRe(q.q), $options: "i" };
    and.push({
      $or: [{ caseId: re }, { subjectName: re }, { householdId: re }, { title: re }],
    } as Filter<CaseDoc>);
  }

  return and.length ? ({ $and: and } as Filter<CaseDoc>) : {};
}

/* ── Listing ──────────────────────────────────────────────────── */
export const SORTS = ["default", "created", "due", "caseId", "priority"] as const;
export type CaseSort = (typeof SORTS)[number];

const PRIORITY_RANK = {
  $switch: {
    branches: [
      { case: { $eq: ["$priority", "urgent"] }, then: 0 },
      { case: { $eq: ["$priority", "high"] }, then: 1 },
      { case: { $eq: ["$priority", "medium"] }, then: 2 },
    ],
    default: 3,
  },
};

/** `_id` is always the last key, so paging never repeats or skips a row. */
function sortStage(sort: CaseSort, dir: 1 | -1): Record<string, 1 | -1> {
  switch (sort) {
    case "created":
      return { createdAt: dir, _id: dir };
    case "due":
      return { _dueSort: dir, _id: 1 };
    case "caseId":
      return { caseId: dir, _id: 1 };
    case "priority":
      return { _closedRank: 1, _prRank: dir, _id: 1 };
    default:
      // Open first, then urgency, nearest due date, newest.
      return { _closedRank: 1, _prRank: 1, _dueSort: 1, createdAt: -1, _id: 1 };
  }
}

export async function listCases(
  filter: Filter<CaseDoc>,
  opts: { page: number; pageSize: number; sort: CaseSort; dir: 1 | -1 }
): Promise<{ docs: CaseDoc[]; total: number }> {
  const col = await casesCol();
  const skip = (opts.page - 1) * opts.pageSize;
  const [docs, total] = await Promise.all([
    col
      .aggregate<CaseDoc>([
        { $match: filter },
        {
          $addFields: {
            _closedRank: { $cond: ["$closed", 1, 0] },
            _prRank: PRIORITY_RANK,
            _dueSort: { $ifNull: ["$dueDate", "9999-99-99"] },
          },
        },
        { $sort: sortStage(opts.sort, opts.dir) },
        { $skip: skip },
        { $limit: opts.pageSize },
        { $project: { _closedRank: 0, _prRank: 0, _dueSort: 0 } },
      ])
      .toArray(),
    col.countDocuments(filter),
  ]);
  return { docs, total };
}

export function parsePaging(p: URLSearchParams) {
  const page = Math.max(Number(p.get("page")) || 1, 1);
  const pageSize = Math.min(
    Math.max(Number(p.get("pageSize")) || PAGE_SIZE_DEFAULT, 1),
    PAGE_SIZE_MAX
  );
  const sort = oneOf(p.get("sort"), SORTS) ?? "default";
  const dir: 1 | -1 = p.get("dir") === "asc" ? 1 : -1;
  return { page, pageSize, sort, dir };
}

/* ── Facets: counts over the WHOLE dataset, not the visible page ── */
export interface CaseFacets {
  total: number;
  status: Record<CaseStatusFilter, number>;
  modules: Record<string, number>;
  segments: Record<string, number>;
  subcategories: Record<string, number>;
  priorities: Record<string, number>;
  settlements: Record<string, number>;
  workflow: Record<string, number>;
  followup: { none: number; submitted: number };
  cms: { id: string; name: string; count: number }[];
}

const toMap = (rows: { _id: unknown; n: number }[]) =>
  Object.fromEntries(rows.filter((r) => r._id != null).map((r) => [String(r._id), r.n]));

export async function caseFacets(
  user: Pick<UserDoc, "_id" | "role">,
  q: CaseQuery
): Promise<CaseFacets> {
  const col = await casesCol();
  const grp = (filter: Filter<CaseDoc>, id: unknown) =>
    col
      .aggregate<{ _id: unknown; n: number }>([
        { $match: filter },
        { $group: { _id: id, n: { $sum: 1 } } },
      ])
      .toArray();

  const [
    full,
    fStatus,
    fModule,
    fSegment,
    fSub,
    fPriority,
    fSettlement,
    fWorkflow,
    fFollowup,
    fCm,
  ] = await Promise.all([
    buildCaseFilter(user, q),
    buildCaseFilter(user, q, ["status"]),
    buildCaseFilter(user, q, ["module", "segment", "subcategory"]),
    buildCaseFilter(user, q, ["segment"]),
    buildCaseFilter(user, q, ["subcategory"]),
    buildCaseFilter(user, q, ["priority"]),
    buildCaseFilter(user, q, ["settlement"]),
    buildCaseFilter(user, q, ["workflow"]),
    buildCaseFilter(user, q, ["followup"]),
    buildCaseFilter(user, q, ["cm"]),
  ]);

  const today = todayStr();
  const and = (a: Filter<CaseDoc>, b: Filter<CaseDoc>) =>
    ({ $and: [a, b] }) as Filter<CaseDoc>;

  const [
    total,
    open,
    closed,
    overdue,
    all,
    modules,
    subs,
    priorities,
    settlements,
    workflow,
    fNone,
    fDone,
    cmRows,
    ...segCounts
  ] = await Promise.all([
    col.countDocuments(full),
    col.countDocuments(and(fStatus, { closed: false })),
    col.countDocuments(and(fStatus, { closed: true })),
    col.countDocuments(and(fStatus, { closed: false, dueDate: { $gt: "", $lt: today } })),
    col.countDocuments(fStatus),
    grp(fModule, "$module"),
    grp(fSub, "$subcategory"),
    grp(fPriority, "$priority"),
    grp(fSettlement, "$settlementCode"),
    grp(fWorkflow, {
      $ifNull: ["$workflowStatus", { $cond: ["$closed", "verified_closed", "open"] }],
    }),
    col.countDocuments(
      and(fFollowup, { $or: [{ followupCount: null }, { followupCount: 0 }] } as Filter<CaseDoc>)
    ),
    col.countDocuments(and(fFollowup, { followupCount: { $gt: 0 } })),
    grp(fCm, { $ifNull: ["$assignedCmId", "$mobiliserId"] }),
    ...SEGMENTS.map((s) => col.countDocuments(and(fSegment, segmentFilter(s.key)))),
  ]);

  const cmIds = cmRows.map((r) => r._id).filter(Boolean) as ObjectId[];
  const users = cmIds.length
    ? await (await usersCol())
        .find({ _id: { $in: cmIds } }, { projection: { name: 1 } })
        .toArray()
    : [];
  const nameById = new Map(users.map((u) => [String(u._id), u.name]));

  return {
    total,
    status: { open, closed, overdue, all },
    modules: toMap(modules),
    segments: Object.fromEntries(SEGMENTS.map((s, i) => [s.key, segCounts[i] as number])),
    subcategories: toMap(subs),
    priorities: toMap(priorities),
    settlements: toMap(settlements),
    workflow: toMap(workflow),
    followup: { none: fNone, submitted: fDone },
    cms: cmRows
      .filter((r) => r._id)
      .map((r) => ({
        id: String(r._id),
        name: nameById.get(String(r._id)) || "Unknown CM",
        count: r.n,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export { MODULE_LIST };
