import type {
  UserDoc,
  ProjectDoc,
  RequisitionDoc,
  ReportDoc,
  SurveyDoc,
  ExpenseDoc,
  LedgerDoc,
  PaymentDoc,
  WeeklyReportDoc,
  CaseDoc,
} from "./models";
import { SETTLEMENT_BY_CODE } from "./questionnaire/settlements";
import { moduleDef, stageLabel, subcategoryLabel } from "./cases/modules";

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
    kind: r.kind ?? "reimbursement",
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

export function publicWeeklyReport(
  w: WeeklyReportDoc,
  extra?: { pmName?: string }
) {
  return {
    id: String(w._id),
    reportId: w.reportId,
    programmeManagerId: String(w.programmeManagerId),
    pmName: extra?.pmName ?? w.pmName ?? null,
    weekStart: w.weekStart,
    weekEnd: w.weekEnd,
    status: w.status,
    dashboard: w.dashboard ?? null,
    settlements: w.settlements ?? [],
    data: w.data ?? {},
    certification: w.certification ?? {},
    directorComments: w.directorComments ?? null,
    directorActionPoints: w.directorActionPoints ?? [],
    reviewedAt: w.reviewedAt ?? null,
    submittedAt: w.submittedAt ?? null,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
  };
}

export function publicReport(
  r: ReportDoc,
  extra?: { mobiliserName?: string }
) {
  return {
    id: String(r._id),
    projectId: r.projectId ? String(r.projectId) : null,
    mobiliserId: String(r.mobiliserId),
    mobiliserName: extra?.mobiliserName ?? null,
    period: r.period,
    periodDate: r.periodDate,
    metrics: r.metrics ?? {},
    data: r.data ?? {},
    notes: r.notes ?? null,
    createdAt: r.createdAt,
  };
}

export function publicCase(c: CaseDoc, extra?: { mobiliserName?: string }) {
  const settlement = SETTLEMENT_BY_CODE[c.settlementCode];
  const def = moduleDef(c.module);
  return {
    id: String(c._id),
    caseId: c.caseId,
    module: c.module,
    moduleTitle: def?.title ?? c.module,
    subcategory: c.subcategory,
    subcategoryLabel: subcategoryLabel(c.module, c.subcategory),
    title: c.title,
    subjectName: c.subjectName ?? null,
    priority: c.priority,
    stage: c.stage,
    stageLabel: stageLabel(c.module, c.stage),
    closed: c.closed,
    householdId: c.householdId,
    surveyId: String(c.surveyId),
    settlementCode: c.settlementCode,
    settlementLabel: settlement?.label ?? c.settlementCode,
    mobiliserName: extra?.mobiliserName ?? null,
    assignee: c.assignee ?? null,
    dueDate: c.dueDate ?? null,
    source: c.source,
    meta: c.meta ?? {},
    fields: c.fields ?? {},
    history: (c.history ?? []).map((h) => ({
      at: h.at,
      stage: h.stage ?? null,
      stageLabel: h.stage ? stageLabel(c.module, h.stage) : null,
      note: h.note ?? null,
      by: h.by ?? null,
    })),
    closedAt: c.closedAt ?? null,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}
export type PublicCase = ReturnType<typeof publicCase>;

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
