import {
  casesCol,
  surveysCol,
  nextSequence,
  type SurveyDoc,
  type CaseDoc,
} from "@/lib/models";
import { deriveCasesFromSurvey } from "./derive";
import { MODULES, firstStage, subcategoryLabel } from "./modules";
import { notifyUsers } from "@/lib/notifications";
import { maternalSegment } from "./segments";
import { ObjectId } from "mongodb";

/**
 * Derive the thematic cases for one survey and upsert them idempotently.
 * Existing cases keep their workflow state, assignee and staff-edited fields;
 * only descriptive fields are refreshed. New cases get a sequential caseId.
 */
export async function upsertCasesForSurvey(
  survey: SurveyDoc,
  opts: { notify?: boolean } = {}
): Promise<{ created: number; updated: number }> {
  const seeds = deriveCasesFromSurvey(survey);
  if (!seeds.length) return { created: 0, updated: 0 };
  const col = await casesCol();
  const now = new Date();
  let created = 0;
  let updated = 0;
  // Tell the CM about each case on a finished survey. The notification is
  // keyed on the case, so re-saving a survey (or re-running a backfill) never
  // repeats it; historical backfills pass notify:false.
  const notifyCm = opts.notify !== false && survey.status === "complete";
  const announce = async (
    caseId: string,
    caseObjectId: unknown,
    subcategory: string,
    module: (typeof seeds)[number]["module"]
  ) => {
    if (!notifyCm || !survey.mobiliserId) return;
    await notifyUsers([survey.mobiliserId], {
      category: "case_opened",
      title: `New follow-up case ${caseId}`,
      body: `${caseId} · ${subcategoryLabel(module, subcategory)} · household ${survey.householdId}. Open it to record your follow-up.`,
      relatedType: "case",
      relatedId: String(caseObjectId),
      dedupeKey: `case_opened:${caseId}`,
    });
  };

  for (const seed of seeds) {
    const existing = await col.findOne({ dedupeKey: seed.dedupeKey });
    if (existing) {
      await col.updateOne(
        { _id: existing._id },
        {
          $set: {
            subcategory: seed.subcategory,
            title: seed.title,
            subjectName: seed.subjectName,
            priority: seed.priority,
            settlementCode: survey.settlementCode,
            householdId: survey.householdId,
            mobiliserId: survey.mobiliserId,
            ...(seed.segment ? { segment: seed.segment } : {}),
            meta: seed.meta ?? existing.meta,
            updatedAt: now,
          },
        }
      );
      // Older cases predate assignment: the surveying CM is responsible.
      await col.updateOne(
        { _id: existing._id, assignedCmId: { $exists: false } },
        { $set: { assignedCmId: survey.mobiliserId } }
      );
      await announce(existing.caseId, existing._id, seed.subcategory, seed.module);
      updated++;
      continue;
    }

    const prefix = MODULES[seed.module].prefix;
    const seq = await nextSequence(`case_${prefix}`);
    const stage = firstStage(seed.module);
    const doc: CaseDoc = {
      caseId: `${prefix}-${String(seq).padStart(4, "0")}`,
      module: seed.module,
      subcategory: seed.subcategory,
      title: seed.title,
      subjectName: seed.subjectName,
      priority: seed.priority,
      stage,
      closed: false,
      dedupeKey: seed.dedupeKey,
      surveyId: survey._id!,
      householdId: survey.householdId,
      settlementCode: survey.settlementCode,
      mobiliserId: survey.mobiliserId,
      dueDate: seed.dueDate,
      source: "survey_auto",
      assignedCmId: survey.mobiliserId,
      segment: seed.segment,
      workflowStatus: "open",
      followupCount: 0,
      meta: seed.meta,
      fields: {},
      history: [{ at: now, stage, note: "Auto-created from survey" }],
      createdAt: now,
      updatedAt: now,
    };
    try {
      const ins = await col.insertOne(doc);
      created++;
      await announce(doc.caseId, ins.insertedId, doc.subcategory, doc.module);
    } catch (e) {
      if ((e as { code?: number }).code === 11000) updated++;
      else throw e;
    }
  }

  return { created, updated };
}

/**
 * Give every maternal case that predates the pregnant / newborn split its
 * segment, read from the pregnancy month on its survey. Additive and
 * idempotent: it only touches cases with no segment yet, never notifies, and
 * never changes anything else. Runs by itself the first time the dashboard
 * is opened after the split, so nobody has to remember a button.
 */
export async function classifyMaternalCases(): Promise<{ classified: number; scanned: number }> {
  const col = await casesCol();
  const todo = await col
    .find({ module: "maternal", segment: null } as never, { projection: { surveyId: 1 } })
    .limit(5000)
    .toArray();
  if (!todo.length) return { classified: 0, scanned: 0 };
  const surveys = await surveysCol();
  const docs = await surveys
    .find({ _id: { $in: [...new Set(todo.map((c) => String(c.surveyId)))].map((i) => new ObjectId(i)) } }, { projection: { data: 1 } })
    .toArray();
  const byId = new Map(docs.map((s) => [String(s._id), s.data || {}]));
  const ops = todo.map((c) => ({
    updateOne: {
      filter: { _id: c._id, segment: null } as never,
      update: { $set: { segment: maternalSegment((byId.get(String(c.surveyId)) || {}) as Record<string, unknown>) } },
    },
  }));
  const res = await col.bulkWrite(ops, { ordered: false });
  return { classified: res.modifiedCount, scanned: todo.length };
}

/** Regenerate cases from every survey (safe to run repeatedly). */
export async function backfillAllCases(): Promise<{
  surveys: number;
  created: number;
  updated: number;
}> {
  const surveys = await surveysCol();
  const cursor = surveys.find({});
  let sc = 0;
  let created = 0;
  let updated = 0;
  for await (const survey of cursor) {
    sc++;
    const r = await upsertCasesForSurvey(survey as SurveyDoc, { notify: false });
    created += r.created;
    updated += r.updated;
  }
  return { surveys: sc, created, updated };
}
