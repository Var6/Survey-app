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
  budgets: "budgets",
  counters: "counters",
  settlements: "settlements",
  notifications: "notifications",
  auditLog: "audit_log",
  caseFollowups: "case_followups",
  caseClosures: "case_closures",
  lookups: "lookups",
  camps: "camps",
  meetings: "meetings",
  calendarLog: "calendar_sync_log",
  meetingRecords: "meeting_records",
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
  /** Family Member records pushed alongside the household. */
  members?: { synced: number; failed: number };
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
  /** Role of the author ("cm" | "programme_manager"); legacy docs are CM. */
  authorRole?: Role;
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

export type CaseWorkflowStatus =
  | "open"
  | "follow_up_in_progress"
  | "closure_requested"
  | "under_review"
  | "revision_required"
  | "verified_closed";

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
  /**
   * Community Mobiliser responsible for follow-up. Defaults to the CM who did
   * the survey; staff can reassign. Missing on older cases — read it through
   * lib/cases/query.ts, which falls back to `mobiliserId`.
   */
  assignedCmId?: ObjectId;
  /**
   * Finer classification inside a module, set when the case is derived
   * (maternal: pregnant | newborn_mother | maternal_unspecified). Education
   * segments are derived from `subcategory` at query time.
   */
  segment?: string;
  /** Follow-up / closure review state — see lib/cases/workflow.ts. Missing = legacy. */
  workflowStatus?: CaseWorkflowStatus;
  followupCount?: number;
  lastFollowupAt?: Date;
  /** The closure request currently awaiting review, if any. */
  closureRequestId?: ObjectId;
  /** Snapshot of the survey answers that triggered this case (context). */
  meta?: Record<string, unknown>;
  /** Staff-editable module fields (referral date, application no., etc.). */
  fields: Record<string, unknown>;
  history: CaseHistoryEntry[];
  closedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Monthly report — one document per author per month.
 * Three variants share this shape (see lib/monthly/variants.ts):
 *   PMM-YYYY-MM        Programme Manager   → reviewed by the Director
 *   CMM-YYYY-MM-<code> Community Mobiliser → reviewed by the Programme Manager
 *   MISM-YYYY-MM       Supervisor cum MIS  → reviewed by the Programme Manager
 */
export interface MonthlyReportDoc {
  _id?: ObjectId;
  reportId: string;
  /** The report's author. Legacy field name — always the author's user id. */
  programmeManagerId: ObjectId;
  /** Missing on legacy documents, which are all Programme Manager reports. */
  authorRole?: Role;
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
  /** Set on submit: was it filed after the monthly deadline? (lib/monthly/deadline.ts) */
  late?: boolean;
  deadlineAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/* ─── Case follow-up and closure review ─────────────────────── */
export interface CaseFollowupDoc {
  _id?: ObjectId;
  caseId: ObjectId;
  caseCode: string;
  cmId: ObjectId;
  cmName: string;
  /** YYYY-MM-DD the follow-up took place. */
  followupDate: string;
  observations: string;
  actionsTaken: string;
  remarks?: string;
  attachments: { key: string; url: string; name?: string }[];
  /** Sent by the form with each submit, so a double tap cannot save twice. */
  clientKey?: string;
  status: "draft" | "submitted";
  submittedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ClosureDecision {
  userId: ObjectId;
  name: string;
  role: Role;
  decision: "approve" | "reject";
  reason?: string;
  at: Date;
}

export interface CaseClosureDoc {
  _id?: ObjectId;
  caseId: ObjectId;
  caseCode: string;
  requestedBy: ObjectId;
  requestedByName: string;
  requestedAt: Date;
  note?: string;
  /** pending → under_review (first decision in) → approved | rejected | superseded. */
  status: "pending" | "under_review" | "approved" | "rejected" | "superseded";
  /** Approval policy in force when the request was made. */
  policy: { mode: string; requiredRoles: Role[]; text: string };
  decisions: ClosureDecision[];
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/* ─── Notifications and audit ───────────────────────────────── */
export type NotificationCategory =
  | "case_opened"
  | "followup_completed"
  | "closure_requested"
  | "closure_approved"
  | "closure_rejected"
  | "camp_created"
  | "camp_updated"
  | "meeting_created"
  | "meeting_updated"
  | "meeting_invited"
  | "meeting_report"
  | "report_reminder";

export interface NotificationDoc {
  _id?: ObjectId;
  userId: ObjectId;
  category: NotificationCategory;
  title: string;
  body: string;
  /** What the notification is about — the client builds the link for the viewer's role. */
  relatedType?: "case" | "camp" | "meeting" | "meeting_record" | "monthly";
  relatedId?: string;
  /** Unique per recipient: a retried job can never notify twice. */
  dedupeKey: string;
  readAt?: Date | null;
  createdAt: Date;
}

export interface AuditDoc {
  _id?: ObjectId;
  at: Date;
  actorId?: ObjectId;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  /** Human reference (case id, camp code) — never beneficiary names. */
  ref?: string;
  summary: string;
  meta?: Record<string, unknown>;
}

/* ─── Configurable lists (camp types, meeting types) ────────── */
export interface LookupDoc {
  _id?: ObjectId;
  list: "camp_type" | "meeting_type" | "meeting_form_type";
  key: string;
  label: string;
  active: boolean;
  order: number;
  createdBy?: ObjectId;
  createdAt: Date;
}

/* ─── Camps ─────────────────────────────────────────────────── */
export type CalendarSyncStatus =
  | "pending"
  | "synced"
  | "failed"
  | "not_configured"
  | "cancelled";

export interface CalendarState {
  status: CalendarSyncStatus;
  eventId?: string;
  htmlLink?: string;
  attempts: number;
  lastAttemptAt?: Date;
  syncedAt?: Date;
  lastError?: string;
}

export interface ScheduleHistory {
  at: Date;
  by: string;
  note: string;
}

export interface CampDoc {
  _id?: ObjectId;
  campCode: string; // CMP-0001
  name: string;
  typeKey: string;
  typeLabel: string;
  description?: string;
  /** YYYY-MM-DD, India time. */
  date: string;
  startTime?: string; // HH:MM
  endTime?: string;
  venue: string;
  settlementCode?: string;
  programme?: string;
  responsibleName?: string;
  responsibleUserId?: ObjectId;
  assignedCmIds: ObjectId[];
  instructions?: string;
  status: "scheduled" | "cancelled" | "completed";
  calendar: CalendarState;
  history: ScheduleHistory[];
  createdBy: ObjectId;
  createdByName: string;
  createdByRole: Role;
  createdAt: Date;
  updatedAt: Date;
}

/* ─── Community meetings ────────────────────────────────────── */
export interface MeetingDoc {
  _id?: ObjectId;
  meetingCode: string; // MTG-0001
  title: string;
  typeKey: string;
  typeLabel: string;
  description?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  location: string;
  settlementCode?: string;
  agenda?: string;
  expectedParticipants?: number;
  notes?: string;
  organiserCmId: ObjectId;
  organiserName: string;
  /** Other CMs tagged to help — any number. */
  taggedCmIds: ObjectId[];
  status: "scheduled" | "cancelled" | "completed";
  history: ScheduleHistory[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A community meeting that HAS happened — the record the Community Mobilisers
 * used to fill in on a Google Form. Office roles (MIS, Programme Manager,
 * Director) read and correct every record; a CM adds records and sees their own.
 * Photos and attendance sheets are Google Drive links, not uploads.
 */
export interface MeetingRecordDoc {
  _id?: ObjectId;
  /** YYYY-MM-DD, India time. */
  meetingDate: string;
  settlementCode?: string;
  /** Community name as shown (the live name when the code is known). */
  communityName: string;
  typeKey: string;
  typeLabel: string;
  topic: string;
  attendanceLinks: string[];
  totalParticipants: number;
  photoLinks: string[];
  remarks?: string;
  /** Who filled it in. Missing on records imported from the old Google Form. */
  cmId?: ObjectId;
  cmName?: string;
  source: "app" | "import";
  /** Stable key of an imported row, so re-running the import never duplicates it. */
  importKey?: string;
  submittedAt: Date;
  history: ScheduleHistory[];
  createdAt: Date;
  updatedAt: Date;
}

/* ─── Programme budget (funder format) ──────────────────────── */
export type BudgetCategory =
  | "salary_program"
  | "salary_admin"
  | "capex"
  | "travel"
  | "program"
  | "admin";
export type InflationType = "salary" | "nil" | "other";

export interface BudgetLineYear {
  units: number;
  unitCost: number;
  /** Percentage of the cost charged to this grant (default 100). */
  allocPct: number;
}

/** "Working sheet" cost break-up for a programme-expense line. */
export interface WorkingBreakup {
  food?: number;
  accommodation?: number;
  resource?: number; // resource fee / consultant
  iec?: number;
  others?: number;
  assumptions?: string;
}

export interface BudgetLine {
  id: string;
  category: BudgetCategory;
  description: string;
  /** Salary / Honorarium / Consultancy (for staff lines). */
  costCategory?: string;
  inflation: InflationType;
  unitType?: string; // Month, Number, one-time, ...
  years: BudgetLineYear[]; // index 0 = Year 1
  notes?: string;
  /** Optional working-sheet break-up (used for programme expenses). */
  working?: WorkingBreakup;
}

export interface BudgetDoc {
  _id?: ObjectId;
  name: string;
  currency: string;
  numYears: number; // 1..5
  /** Inflation % per type, applied as (1+r)^(yearIndex). */
  inflationRates: { salary: number; nil: number; other: number };
  lines: BudgetLine[];
  createdBy?: ObjectId;
  createdByName?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * A community / informal settlement. Seeded from the original twelve, then
 * managed in the app by the Director, Programme Manager or MIS.
 * `code` and `hhPrefix` are fixed once created — household IDs are built from
 * the prefix and existing survey data refers to the code.
 */
export interface SettlementDoc {
  _id?: ObjectId;
  code: string;
  label: string;
  hhPrefix: string;
  active: boolean;
  order: number;
  createdBy?: ObjectId;
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
export const budgetsCol = () => col<BudgetDoc>(COLLECTIONS.budgets);
export const countersCol = () => col<CounterDoc>(COLLECTIONS.counters);
export const settlementsCol = () => col<SettlementDoc>(COLLECTIONS.settlements);
export const notificationsCol = () =>
  col<NotificationDoc>(COLLECTIONS.notifications);
export const auditCol = () => col<AuditDoc>(COLLECTIONS.auditLog);
export const caseFollowupsCol = () =>
  col<CaseFollowupDoc>(COLLECTIONS.caseFollowups);
export const caseClosuresCol = () => col<CaseClosureDoc>(COLLECTIONS.caseClosures);
export const lookupsCol = () => col<LookupDoc>(COLLECTIONS.lookups);
export const campsCol = () => col<CampDoc>(COLLECTIONS.camps);
export const meetingsCol = () => col<MeetingDoc>(COLLECTIONS.meetings);
export const meetingRecordsCol = () =>
  col<MeetingRecordDoc>(COLLECTIONS.meetingRecords);
export const calendarLogCol = () =>
  col<{
    _id?: ObjectId;
    campId: ObjectId;
    at: Date;
    action: string;
    ok: boolean;
    detail?: string;
  }>(COLLECTIONS.calendarLog);

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
    db
      .collection(COLLECTIONS.settlements)
      .createIndex({ code: 1 }, { unique: true }),
    db
      .collection(COLLECTIONS.settlements)
      .createIndex({ hhPrefix: 1 }, { unique: true }),
    // Case list: module/segment/status filters, the assigned-CM scope, dates.
    db
      .collection(COLLECTIONS.cases)
      .createIndex({ module: 1, subcategory: 1, closed: 1, createdAt: -1 }),
    db.collection(COLLECTIONS.cases).createIndex({ assignedCmId: 1, closed: 1 }),
    db.collection(COLLECTIONS.cases).createIndex({ mobiliserId: 1, closed: 1 }),
    db.collection(COLLECTIONS.cases).createIndex({ workflowStatus: 1, updatedAt: -1 }),
    db.collection(COLLECTIONS.cases).createIndex({ caseId: 1 }),
    db
      .collection(COLLECTIONS.caseFollowups)
      .createIndex({ caseId: 1, createdAt: -1 }),
    db.collection(COLLECTIONS.caseFollowups).createIndex(
      { caseId: 1, clientKey: 1 },
      { unique: true, partialFilterExpression: { clientKey: { $type: "string" } } }
    ),
    db
      .collection(COLLECTIONS.caseClosures)
      .createIndex({ caseId: 1, createdAt: -1 }),
    db
      .collection(COLLECTIONS.caseClosures)
      .createIndex({ status: 1, requestedAt: -1 }),
    db
      .collection(COLLECTIONS.caseClosures)
      .createIndex({ "decisions.userId": 1 }),
    // One notification per recipient per event, however often a job retries.
    db
      .collection(COLLECTIONS.notifications)
      .createIndex({ userId: 1, dedupeKey: 1 }, { unique: true }),
    db
      .collection(COLLECTIONS.notifications)
      .createIndex({ userId: 1, readAt: 1, createdAt: -1 }),
    db
      .collection(COLLECTIONS.auditLog)
      .createIndex({ entityType: 1, entityId: 1, at: -1 }),
    db
      .collection(COLLECTIONS.lookups)
      .createIndex({ list: 1, key: 1 }, { unique: true }),
    db.collection(COLLECTIONS.camps).createIndex({ campCode: 1 }, { unique: true }),
    db.collection(COLLECTIONS.camps).createIndex({ date: -1 }),
    db.collection(COLLECTIONS.camps).createIndex({ assignedCmIds: 1, date: -1 }),
    db
      .collection(COLLECTIONS.meetings)
      .createIndex({ meetingCode: 1 }, { unique: true }),
    db.collection(COLLECTIONS.meetings).createIndex({ date: -1 }),
    db.collection(COLLECTIONS.meetings).createIndex({ organiserCmId: 1, date: -1 }),
    db.collection(COLLECTIONS.meetings).createIndex({ taggedCmIds: 1, date: -1 }),
    db
      .collection(COLLECTIONS.calendarLog)
      .createIndex({ campId: 1, at: -1 }),
    db
      .collection(COLLECTIONS.meetingRecords)
      .createIndex({ meetingDate: -1, _id: -1 }),
    db
      .collection(COLLECTIONS.meetingRecords)
      .createIndex({ cmId: 1, meetingDate: -1 }),
    db
      .collection(COLLECTIONS.meetingRecords)
      .createIndex({ settlementCode: 1, meetingDate: -1 }),
    db.collection(COLLECTIONS.meetingRecords).createIndex(
      { importKey: 1 },
      { unique: true, partialFilterExpression: { importKey: { $type: "string" } } }
    ),
  ]);

  indexesEnsured = true;
}
