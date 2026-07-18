import type {
  UserDoc,
  ProjectDoc,
  RequisitionDoc,
  ReportDoc,
  SurveyDoc,
  ExpenseDoc,
  LedgerDoc,
  PaymentDoc,
} from "./models";
import { SETTLEMENT_BY_CODE } from "./questionnaire/settlements";

/** Public-safe user shape (no password hash). */
export function publicUser(u: UserDoc) {
  return {
    id: String(u._id),
    role: u.role,
    name: u.name,
    email: u.email,
    phone: u.phone ?? null,
    avatarUrl: u.avatarUrl ?? null,
    mobiliserCode: u.mobiliserCode ?? null,
    projectId: u.projectId ? String(u.projectId) : null,
    communities: u.communities ?? [],
    active: u.active,
    createdAt: u.createdAt,
  };
}
export type PublicUser = ReturnType<typeof publicUser>;

export function publicProject(p: ProjectDoc) {
  const balance = (p.totalFunds || 0) - (p.spentFunds || 0);
  return {
    id: String(p._id),
    name: p.name,
    code: p.code ?? null,
    funder: p.funder ?? null,
    description: p.description ?? null,
    currency: p.currency,
    totalFunds: p.totalFunds || 0,
    spentFunds: p.spentFunds || 0,
    balance,
    startDate: p.startDate ?? null,
    endDate: p.endDate ?? null,
    active: p.active,
    createdAt: p.createdAt,
  };
}

export function publicRequisition(
  r: RequisitionDoc,
  extra?: { mobiliserName?: string; projectName?: string }
) {
  return {
    id: String(r._id),
    projectId: String(r.projectId),
    projectName: extra?.projectName ?? null,
    mobiliserId: String(r.mobiliserId),
    mobiliserName: extra?.mobiliserName ?? null,
    category: r.category,
    amount: r.amount,
    currency: r.currency,
    purpose: r.purpose,
    description: r.description ?? null,
    receipts: r.receipts ?? [],
    status: r.status,
    reviewNote: r.reviewNote ?? null,
    reviewedAt: r.reviewedAt ?? null,
    paidAt: r.paidAt ?? null,
    paymentRef: r.paymentRef ?? null,
    createdAt: r.createdAt,
  };
}

export function publicExpense(
  e: ExpenseDoc,
  extra?: { projectName?: string }
) {
  return {
    id: String(e._id),
    projectId: String(e.projectId),
    projectName: extra?.projectName ?? null,
    category: e.category,
    amount: e.amount,
    currency: e.currency,
    description: e.description ?? null,
    paidTo: e.paidTo ?? null,
    date: e.date,
    receipts: e.receipts ?? [],
    createdByName: e.createdByName ?? null,
    createdAt: e.createdAt,
  };
}

export function publicPayment(
  p: PaymentDoc,
  extra?: { projectName?: string }
) {
  return {
    id: String(p._id),
    projectId: String(p.projectId),
    projectName: extra?.projectName ?? null,
    mobiliserId: String(p.mobiliserId),
    mobiliserName: p.mobiliserName ?? null,
    type: p.type,
    amount: p.amount,
    currency: p.currency,
    period: p.period ?? null,
    note: p.note ?? null,
    status: p.status,
    paidAt: p.paidAt ?? null,
    paymentRef: p.paymentRef ?? null,
    createdAt: p.createdAt,
  };
}

export function publicLedgerEntry(l: LedgerDoc) {
  return {
    id: String(l._id),
    projectId: String(l.projectId),
    type: l.type,
    amount: l.amount,
    balanceAfter: l.balanceAfter,
    refType: l.refType ?? null,
    note: l.note ?? null,
    createdAt: l.createdAt,
  };
}

export function publicReport(
  r: ReportDoc,
  extra?: { mobiliserName?: string }
) {
  return {
    id: String(r._id),
    projectId: String(r.projectId),
    mobiliserId: String(r.mobiliserId),
    mobiliserName: extra?.mobiliserName ?? null,
    period: r.period,
    periodDate: r.periodDate,
    metrics: r.metrics ?? {},
    notes: r.notes ?? null,
    createdAt: r.createdAt,
  };
}

export function publicSurvey(
  s: SurveyDoc,
  extra?: { mobiliserName?: string }
) {
  const settlement = SETTLEMENT_BY_CODE[s.settlementCode];
  const d = s.data || {};
  return {
    id: String(s._id),
    householdId: s.householdId,
    settlementCode: s.settlementCode,
    settlementLabel: settlement?.label ?? s.settlementCode,
    mobiliserId: String(s.mobiliserId),
    mobiliserCode: s.mobiliserCode ?? null,
    mobiliserName: extra?.mobiliserName ?? null,
    headName: (d.head_name as string) ?? null,
    totalMembers: (d.hh_total_members as number) ?? null,
    status: s.status,
    sync: {
      status: s.sync?.status ?? "pending",
      frappeId: s.sync?.frappeId ?? null,
      attempts: s.sync?.attempts ?? 0,
      error: s.sync?.error ?? null,
      syncedAt: s.sync?.syncedAt ?? null,
    },
    createdAt: s.createdAt,
    submittedAt: s.submittedAt ?? null,
  };
}
