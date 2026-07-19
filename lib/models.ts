import { Collection, Db, ObjectId } from "mongodb";
import { getDb } from "./db";
import type { CaseModule, CasePriority } from "./cases/modules";

/* ─────────────────────────────────────────────────────────────
 * Collection names
 * ───────────────────────────────────────────────────────────── */
export const COLLECTIONS = {
  users: "users",
  projects: "projects",
  surveys: "surveys",
  requisitions: "requisitions",
  expenses: "expenses",
  payments: "payments",
  ledger: "fund_ledger",
  reports: "reports",
  weeklyReports: "weekly_reports",
  monthlyReports: "monthly_reports",
  cases: "cases",
  counters: "counters",
} as const;

/* ─────────────────────────────────────────────────────────────
 * Shared enums / literal unions
 * ───────────────────────────────────────────────────────────── */
export type Role =
  | "director"
  | "cm"
  | "accountant"
  | "programme_manager"
  | "mis";
export type SyncStatus = "pending" | "synced" | "failed";
export type SurveyStatus = "complete" | "partial" | "refused_midway";
export type RequisitionStatus = "pending" | "approved" | "rejected" | "paid";
/** advance = money requested before spending; reimbursement = claim after spending. */
export type RequisitionKind = "advance" | "reimbursement";
export type PaymentType = "salary" | "benefit" | "bonus" | "other";
export type PaymentStatus = "pending" | "paid";
export type LedgerType = "allocation" | "debit" | "adjustment";
export type ReportPeriod = "daily" | "weekly" | "monthly";

/* ─────────────────────────────────────────────────────────────
 * Documents
 * ───────────────────────────────────────────────────────────── */
export interface UserDoc {
  _id?: ObjectId;
  role: Role;
  name: string;
  email: string; // lowercased, unique — used as login id
  passwordHash: string;
  phone?: string;
  avatarUrl?: string;
  avatarKey?: string;
  /** For CMs: the M01..M06 style mobiliser code used in household IDs. */
  mobiliserCode?: string;
  /** For CMs: project they belong to. */
  projectId?: ObjectId;
  /** For CMs: settlement backend codes they are assigned to. */
  communities?: string[];
  active: boolean;
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectDoc {
  _id?: ObjectId;
  name: string;
  code?: string;
  funder?: string; // e.g. "Azim Premji Foundation"
  description?: string;
  currency: string; // e.g. "INR"
  /** Total sanctioned funds for the project. */
  totalFunds: number;
  /** Sum of approved+paid debits. Derived, kept for quick reads. */
  spentFunds: number;
  startDate?: Date;
  endDate?: Date;
  active: boolean;
  createdBy?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface SyncState {
  status: SyncStatus;
  frappeId?: string; // e.g. "HHD11736" — the created Frappe doc name
  attempts: number;
  lastAttemptAt?: Date;
  syncedAt?: Date;
  error?: string;
}

export interface SurveyDoc {
  _id?: ObjectId;
  projectId: ObjectId;
  mobiliserId: ObjectId;
  mobiliserCode?: string;
  settlementCode: string; // backend code e.g. "refugee_colony"
  /** Human household id, e.g. REF-M01-0007. */
  householdId: string;
  formVersion: string;
  status: SurveyStatus;
  /** All questionnaire answers keyed by web-app variable name. */
  data: Record<string, unknown>;
  /** Repeat groups. */
  members?: Record<string, unknown>[];
  children_0_3?: Record<string, unknown>[];
  children_4_12?: Record<string, unknown>[];
  youth_13_24?: Record<string, unknown>[];
  gps?: { lat: number; lng: number; accuracy?: number } | null;
  /** R2 object keys/urls attached to the survey (consent photo, etc.). */
  images?: { key: string; url: string; kind?: string }[];
  sync: SyncState;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequisitionDoc {
  _id?: ObjectId;
  projectId: ObjectId;
  mobiliserId: ObjectId;
  kind: RequisitionKind;
  category: string; // travel, materials, refreshments, other...
  amount: number;
  currency: string;
  purpose: string;
  description?: string;
  /** Receipt / proof images in R2. */
  receipts: { key: string; url: string }[];
  status: RequisitionStatus;
  reviewedBy?: ObjectId;
  reviewedAt?: Date;
  reviewNote?: string;
  paidAt?: Date;
  paymentRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExpenseDoc {
  _id?: ObjectId;
  projectId: ObjectId;
  category: string; // travel, materials, camp, salary, refreshments, other...
  amount: number;
  currency: string;
  description?: string;
  paidTo?: string;
  date: Date;
  receipts: { key: string; url: string }[];
  createdBy?: ObjectId;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentDoc {
  _id?: ObjectId;
  projectId: ObjectId;
  mobiliserId: ObjectId;
  mobiliserName?: string;
  type: PaymentType; // salary, benefit, bonus, other
  amount: number;
  currency: string;
  /** For salary: the month it covers, e.g. "2026-07". */
  period?: string;
  note?: string;
  status: PaymentStatus;
  createdBy?: ObjectId;
  createdByName?: string;
  paidAt?: Date;
  paymentRef?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface LedgerDoc {
  _id?: ObjectId;
  projectId: ObjectId;
  type: LedgerType;
  amount: number; // positive number; `type` gives direction
  /** What this entry refers to (e.g. requisition). */
  refType?: string;
  refId?: ObjectId;
  balanceAfter: number;
  note?: string;
  createdBy?: ObjectId;
  createdAt: Date;
}

export interface ReportDoc {
  _id?: ObjectId;
  projectId?: ObjectId;
  mobiliserId: ObjectId;
  period: ReportPeriod;
  /** The day/week/month this report covers (start of period). */
  periodDate: Date;
  metrics: Record<string, number>; // legacy simple metrics
  /** Structured, schema-driven answers (dynamic daily report). */
  data?: Record<string, unknown>;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type WeeklyStatus = "draft" | "submitted" | "returned" | "approved";

export interface SettlementStatus {
  code: string;
  status: "green" | "amber" | "red";
  reason?: string;
  corrective?: string;
}
export interface WeeklyActionPoint {
  action: string;
  owner?: string;
  due?: string;
}

/** Programme Manager weekly report (PMW module). */
export interface WeeklyReportDoc {
  _id?: ObjectId;
  reportId: string; // PMW-YYYY-WW
  programmeManagerId: ObjectId;
  pmName?: string;
  weekStart: Date;
  weekEnd: Date;
  status: WeeklyStatus;
  /** Auto-populated dashboard snapshot at last refresh. */
  dashboard?: Record<string, unknown>;
  /** Settlement traffic-light control table. */
  settlements?: SettlementStatus[];
  /** Manager accountability answers keyed by PMW field. */
  data?: Record<string, unknown>;
  certification?: Record<string, boolean | string>;
  directorComments?: string;
  directorActionPoints?: WeeklyActionPoint[];
  reviewedBy?: ObjectId;
  reviewedAt?: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/* ─── Thematic case management ──────────────────────────────── */
export interface CaseHistoryEntry {
  at: Date;
  stage?: string;
  note?: string;
  by?: string;
}

export interface CaseDoc {
  _id?: ObjectId;
  caseId: string; // e.g. HLT-0001
  module: CaseModule;
  subcategory: string;
  title: string;
  subjectName?: string;
  priority: CasePriority;
  /** Current workflow stage key (module-specific). */
  stage: string;
  closed: boolean;
  /** Deterministic key that makes auto-derivation idempotent. */
  dedupeKey: string;
  surveyId: ObjectId;
  householdId: string;
  settlementCode: string;
  mobiliserId?: ObjectId;
  /** Staff member the case is assigned to (free text for now). */
  assignee?: string;
  /** Follow-up / due date, YYYY-MM-DD. */
  dueDate?: string;
  source: "survey_auto" | "manual";
  /** Snapshot of the survey answers that triggered this case (context). */
  meta?: Record<string, unknown>;
  /** Staff-editable module fields (referral date, application no., etc.). */
  fields: Record<string, unknown>;
  history: CaseHistoryEntry[];
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Programme Manager monthly report (PMM module). */
export interface MonthlyReportDoc {
  _id?: ObjectId;
  reportId: string; // PMM-YYYY-MM
  programmeManagerId: ObjectId;
  pmName?: string;
  monthStart: Date;
  monthEnd: Date;
  status: WeeklyStatus;
  dashboard?: Record<string, unknown>;
  settlements?: SettlementStatus[];
  data?: Record<string, unknown>;
  certification?: Record<string, boolean | string>;
  directorComments?: string;
  directorActionPoints?: WeeklyActionPoint[];
  reviewedBy?: ObjectId;
  reviewedAt?: Date;
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface CounterDoc {
  _id: string; // the counter key
  seq: number;
}

/* ─────────────────────────────────────────────────────────────
 * Typed collection getters
 * ───────────────────────────────────────────────────────────── */
export const usersCol = () => col<UserDoc>(COLLECTIONS.users);
export const projectsCol = () => col<ProjectDoc>(COLLECTIONS.projects);
export const surveysCol = () => col<SurveyDoc>(COLLECTIONS.surveys);
export const requisitionsCol = () => col<RequisitionDoc>(COLLECTIONS.requisitions);
export const expensesCol = () => col<ExpenseDoc>(COLLECTIONS.expenses);
export const paymentsCol = () => col<PaymentDoc>(COLLECTIONS.payments);
export const ledgerCol = () => col<LedgerDoc>(COLLECTIONS.ledger);
export const reportsCol = () => col<ReportDoc>(COLLECTIONS.reports);
export const weeklyReportsCol = () =>
  col<WeeklyReportDoc>(COLLECTIONS.weeklyReports);
export const monthlyReportsCol = () =>
  col<MonthlyReportDoc>(COLLECTIONS.monthlyReports);
export const casesCol = () => col<CaseDoc>(COLLECTIONS.cases);
export const countersCol = () => col<CounterDoc>(COLLECTIONS.counters);

async function col<T extends import("mongodb").Document>(
  name: string
): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}

/* ─────────────────────────────────────────────────────────────
 * Atomic sequence counter (for household IDs, etc.)
 * ───────────────────────────────────────────────────────────── */
export async function nextSequence(key: string): Promise<number> {
  const counters = await countersCol();
  const res = await counters.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  return res?.seq ?? 1;
}

/* ─────────────────────────────────────────────────────────────
 * Index setup — call once on boot (idempotent).
 * ───────────────────────────────────────────────────────────── */
let indexesEnsured = false;
export async function ensureIndexes(): Promise<void> {
  if (indexesEnsured) return;
  const db: Db = await getDb();

  await Promise.all([
    db
      .collection(COLLECTIONS.users)
      .createIndex({ email: 1 }, { unique: true }),
    db.collection(COLLECTIONS.users).createIndex({ projectId: 1, role: 1 }),
    db.collection(COLLECTIONS.projects).createIndex({ createdAt: -1 }),
    db
      .collection(COLLECTIONS.surveys)
      .createIndex({ householdId: 1 }, { unique: true }),
    db
      .collection(COLLECTIONS.surveys)
      .createIndex({ mobiliserId: 1, createdAt: -1 }),
    db
      .collection(COLLECTIONS.surveys)
      .createIndex({ settlementCode: 1, createdAt: -1 }),
    db.collection(COLLECTIONS.surveys).createIndex({ "sync.status": 1 }),
    db
      .collection(COLLECTIONS.requisitions)
      .createIndex({ projectId: 1, status: 1, createdAt: -1 }),
    db
      .collection(COLLECTIONS.requisitions)
      .createIndex({ mobiliserId: 1, createdAt: -1 }),
    db
      .collection(COLLECTIONS.expenses)
      .createIndex({ projectId: 1, date: -1 }),
    db
      .collection(COLLECTIONS.payments)
      .createIndex({ mobiliserId: 1, status: 1, createdAt: -1 }),
    db.collection(COLLECTIONS.ledger).createIndex({ projectId: 1, createdAt: -1 }),
    db
      .collection(COLLECTIONS.reports)
      .createIndex({ mobiliserId: 1, period: 1, periodDate: -1 }),
    db
      .collection(COLLECTIONS.weeklyReports)
      .createIndex({ reportId: 1 }, { unique: true }),
    db
      .collection(COLLECTIONS.weeklyReports)
      .createIndex({ programmeManagerId: 1, weekStart: -1 }),
    db.collection(COLLECTIONS.weeklyReports).createIndex({ status: 1 }),
    db
      .collection(COLLECTIONS.monthlyReports)
      .createIndex({ reportId: 1 }, { unique: true }),
    db
      .collection(COLLECTIONS.monthlyReports)
      .createIndex({ programmeManagerId: 1, monthStart: -1 }),
    db.collection(COLLECTIONS.monthlyReports).createIndex({ status: 1 }),
    db.collection(COLLECTIONS.cases).createIndex({ dedupeKey: 1 }, { unique: true }),
    db
      .collection(COLLECTIONS.cases)
      .createIndex({ module: 1, closed: 1, priority: 1, createdAt: -1 }),
    db.collection(COLLECTIONS.cases).createIndex({ settlementCode: 1 }),
    db.collection(COLLECTIONS.cases).createIndex({ householdId: 1 }),
    db.collection(COLLECTIONS.cases).createIndex({ closed: 1, dueDate: 1 }),
  ]);

  indexesEnsured = true;
}
