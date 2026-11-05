import type { Filter } from "mongodb";
import {
  requisitionsCol,
  usersCol,
  projectsCol,
  expensesCol,
  paymentsCol,
  type RequisitionDoc,
  type UserDoc,
} from "@/lib/models";
import { istParts } from "@/lib/time";

/**
 * Requisitions (advances) and reimbursements — one definition of "which
 * requests match", used by the list, its status counts, the accountant's
 * dashboard tiles and the Director's overview, so a tile and the page it
 * opens always show the same number.
 */

export const REQUEST_STATUSES = ["pending", "approved", "paid", "rejected"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const REQUEST_KINDS = ["advance", "reimbursement"] as const;
export type RequestKind = (typeof REQUEST_KINDS)[number];

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  pending: "Waiting for approval",
  approved: "Approved, to be paid",
  paid: "Paid",
  rejected: "Rejected",
};

export interface RequestQuery {
  status?: RequestStatus;
  kind?: RequestKind;
  /** Free text: the requester's name, purpose, category or payment reference. */
  q?: string;
  from?: string;
  to?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseRequestQuery(p: URLSearchParams): RequestQuery {
  const status = p.get("status");
  const kind = p.get("kind");
  return {
    status: (REQUEST_STATUSES as readonly string[]).includes(status || "") ? (status as RequestStatus) : undefined,
    kind: (REQUEST_KINDS as readonly string[]).includes(kind || "") ? (kind as RequestKind) : undefined,
    q: (p.get("q") || "").trim() || undefined,
    from: DATE.test(p.get("from") || "") ? p.get("from")! : undefined,
    to: DATE.test(p.get("to") || "") ? p.get("to")! : undefined,
  };
}

export async function buildRequestFilter(
  user: Pick<UserDoc, "_id" | "role">,
  q: RequestQuery,
  omit: ("status" | "kind")[] = []
): Promise<Filter<RequisitionDoc>> {
  const and: Filter<RequisitionDoc>[] = [];
  if (user.role === "cm") and.push({ mobiliserId: user._id! });
  if (q.status && !omit.includes("status")) and.push({ status: q.status });
  if (q.kind && !omit.includes("kind")) {
    // Requests made before "kind" existed were all reimbursements.
    and.push(
      q.kind === "reimbursement"
        ? ({ $or: [{ kind: "reimbursement" }, { kind: { $exists: false } }] } as Filter<RequisitionDoc>)
        : { kind: "advance" }
    );
  }
  if (q.from || q.to) {
    const range: Record<string, Date> = {};
    if (q.from) range.$gte = new Date(`${q.from}T00:00:00+05:30`);
    if (q.to) range.$lte = new Date(`${q.to}T23:59:59.999+05:30`);
    and.push({ createdAt: range } as Filter<RequisitionDoc>);
  }
  if (q.q) {
    const re = { $regex: escapeRe(q.q), $options: "i" };
    const users = await usersCol();
    const people = await users.find({ name: re }, { projection: { _id: 1 } }).limit(50).toArray();
    and.push({
      $or: [
        { purpose: re },
        { category: re },
        { description: re },
        { paymentRef: re },
        ...(people.length ? [{ mobiliserId: { $in: people.map((u) => u._id!) } }] : []),
      ],
    } as Filter<RequisitionDoc>);
  }
  return and.length ? ({ $and: and } as Filter<RequisitionDoc>) : {};
}

export interface Bucket {
  count: number;
  amount: number;
}

/** Counts and rupee totals per status and per kind, for the filters above the list. */
export async function requestFacets(user: Pick<UserDoc, "_id" | "role">, q: RequestQuery) {
  const col = await requisitionsCol();
  const group = (field: "status" | "kind") => [
    { $group: { _id: field === "kind" ? { $ifNull: ["$kind", "reimbursement"] } : "$status", n: { $sum: 1 }, amount: { $sum: "$amount" } } },
  ];
  const [byStatus, byKind, matching] = await Promise.all([
    col.aggregate([{ $match: await buildRequestFilter(user, q, ["status"]) }, ...group("status")]).toArray(),
    col.aggregate([{ $match: await buildRequestFilter(user, q, ["kind"]) }, ...group("kind")]).toArray(),
    col
      .aggregate([{ $match: await buildRequestFilter(user, q) }, { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: "$amount" } } }])
      .toArray(),
  ]);
  const pick = (rows: { _id: unknown; n: number; amount: number }[], key: string): Bucket => {
    const r = rows.find((x) => x._id === key);
    return { count: r?.n || 0, amount: r?.amount || 0 };
  };
  return {
    status: Object.fromEntries(
      REQUEST_STATUSES.map((s) => [s, pick(byStatus as never, s)])
    ) as Record<RequestStatus, Bucket>,
    kind: Object.fromEntries(REQUEST_KINDS.map((k) => [k, pick(byKind as never, k)])) as Record<RequestKind, Bucket>,
    matching: { count: (matching[0]?.n as number) || 0, amount: (matching[0]?.amount as number) || 0 },
  };
}

/* ── Accountant dashboard ─────────────────────────────────────── */

export interface FinanceTile {
  key: string;
  label: string;
  value: number;
  /** Rupees behind the count, when it is a money tile. */
  amount?: number;
  hint?: string;
  tone?: "normal" | "warn" | "alert";
  /** Where the tile goes, relative to the finance area. */
  href: string;
}

export interface FinanceMetrics {
  currency: string;
  funds: { total: number; spent: number; balance: number; percentSpent: number };
  projects: { id: string; name: string; total: number; spent: number; balance: number }[];
  tiles: FinanceTile[];
  month: { label: string; expenses: Bucket; paidRequests: Bucket; salaryPaid: Bucket };
  oldestPendingDays: number | null;
  /** Approved requests that cost more than the project has left. */
  blockedByBalance: number;
}

const monthRange = () => {
  const { year, month } = istParts();
  const from = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - 5.5 * 3600 * 1000);
  const to = new Date(Date.UTC(year, month, 1, 0, 0, 0) - 5.5 * 3600 * 1000 - 1);
  const label = new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
  return { from, to, label, fromStr: `${year}-${String(month).padStart(2, "0")}-01` };
};

export async function computeFinanceMetrics(user: Pick<UserDoc, "_id" | "role">): Promise<FinanceMetrics> {
  const [reqs, projectsC, expensesC, paymentsC] = await Promise.all([requisitionsCol(), projectsCol(), expensesCol(), paymentsCol()]);
  const mr = monthRange();

  const bucket = async (q: RequestQuery): Promise<Bucket> => {
    const r = await reqs
      .aggregate([{ $match: await buildRequestFilter(user, q) }, { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: "$amount" } } }])
      .toArray();
    return { count: (r[0]?.n as number) || 0, amount: (r[0]?.amount as number) || 0 };
  };

  const [pendingAdv, pendingReim, approved, paidMonth, rejectedMonth, oldest, projects, expMonth, salaryMonth, approvedDocs] =
    await Promise.all([
      bucket({ status: "pending", kind: "advance" }),
      bucket({ status: "pending", kind: "reimbursement" }),
      bucket({ status: "approved" }),
      bucket({ status: "paid", from: mr.fromStr }),
      bucket({ status: "rejected", from: mr.fromStr }),
      reqs.find({ status: "pending" }).sort({ createdAt: 1 }).limit(1).toArray(),
      projectsC.find({ active: true }).sort({ name: 1 }).toArray(),
      expensesC
        .aggregate([{ $match: { date: { $gte: mr.from, $lte: mr.to } } }, { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: "$amount" } } }])
        .toArray(),
      paymentsC
        .aggregate([
          { $match: { status: "paid", paidAt: { $gte: mr.from, $lte: mr.to } } },
          { $group: { _id: null, n: { $sum: 1 }, amount: { $sum: "$amount" } } },
        ])
        .toArray(),
      reqs.find({ status: "approved" }).project({ projectId: 1, amount: 1 }).toArray(),
    ]);

  const total = projects.reduce((s, p) => s + (p.totalFunds || 0), 0);
  const spent = projects.reduce((s, p) => s + (p.spentFunds || 0), 0);
  const balanceOf = new Map(projects.map((p) => [String(p._id), (p.totalFunds || 0) - (p.spentFunds || 0)]));
  const blockedByBalance = approvedDocs.filter((d) => d.amount > (balanceOf.get(String(d.projectId)) ?? 0)).length;
  const oldestPendingDays = oldest[0]
    ? Math.max(0, Math.floor((Date.now() - new Date(oldest[0].createdAt).getTime()) / 86400000))
    : null;

  const tiles: FinanceTile[] = [
    {
      key: "pending_advance",
      label: "Requisitions waiting for approval",
      value: pendingAdv.count,
      amount: pendingAdv.amount,
      hint: "Advances asked for before spending",
      tone: pendingAdv.count > 0 ? "warn" : "normal",
      href: "/finance/requisitions?kind=advance&status=pending",
    },
    {
      key: "pending_reimbursement",
      label: "Reimbursements waiting for approval",
      value: pendingReim.count,
      amount: pendingReim.amount,
      hint: "Claims for money already spent",
      tone: pendingReim.count > 0 ? "warn" : "normal",
      href: "/finance/requisitions?kind=reimbursement&status=pending",
    },
    {
      key: "approved",
      label: "Approved, waiting to be paid",
      value: approved.count,
      amount: approved.amount,
      hint: blockedByBalance > 0 ? `${blockedByBalance} more than the project balance` : "Ready to pay",
      tone: blockedByBalance > 0 ? "alert" : approved.count > 0 ? "warn" : "normal",
      href: "/finance/requisitions?status=approved",
    },
    {
      key: "paid_month",
      label: `Paid in ${mr.label}`,
      value: paidMonth.count,
      amount: paidMonth.amount,
      href: `/finance/requisitions?status=paid&from=${mr.fromStr}`,
    },
    {
      key: "rejected_month",
      label: `Rejected in ${mr.label}`,
      value: rejectedMonth.count,
      amount: rejectedMonth.amount,
      href: `/finance/requisitions?status=rejected&from=${mr.fromStr}`,
    },
  ];

  return {
    currency: projects[0]?.currency || "INR",
    funds: {
      total,
      spent,
      balance: total - spent,
      percentSpent: total > 0 ? Math.round((spent / total) * 100) : 0,
    },
    projects: projects.map((p) => ({
      id: String(p._id),
      name: p.name,
      total: p.totalFunds || 0,
      spent: p.spentFunds || 0,
      balance: (p.totalFunds || 0) - (p.spentFunds || 0),
    })),
    tiles,
    month: {
      label: mr.label,
      expenses: { count: (expMonth[0]?.n as number) || 0, amount: (expMonth[0]?.amount as number) || 0 },
      paidRequests: paidMonth,
      salaryPaid: { count: (salaryMonth[0]?.n as number) || 0, amount: (salaryMonth[0]?.amount as number) || 0 },
    },
    oldestPendingDays,
    blockedByBalance,
  };
}

/** Requests the finance team still has to act on (sidebar badge). */
export async function openRequestCount(): Promise<number> {
  try {
    const col = await requisitionsCol();
    return await col.countDocuments({ status: { $in: ["pending", "approved"] } });
  } catch {
    return 0;
  }
}

