import {
  casesCol,
  surveysCol,
  nextSequence,
  type SurveyDoc,
  type CaseDoc,
} from "@/lib/models";
import { deriveCasesFromSurvey } from "./derive";
import { MODULES, firstStage } from "./modules";

/**
 * Derive the thematic cases for one survey and upsert them idempotently.
 * Existing cases keep their workflow state, assignee and staff-edited fields;
 * only descriptive fields are refreshed. New cases get a sequential caseId.
 */
export async function upsertCasesForSurvey(
  survey: SurveyDoc
): Promise<{ created: number; updated: number }> {
  const seeds = deriveCasesFromSurvey(survey);
  if (!seeds.length) return { created: 0, updated: 0 };
  const col = await casesCol();
  const now = new Date();
  let created = 0;
  let updated = 0;

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
            meta: seed.meta ?? existing.meta,
            updatedAt: now,
          },
        }
      );
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
      meta: seed.meta,
      fields: {},
      history: [{ at: now, stage, note: "Auto-created from survey" }],
      createdAt: now,
      updatedAt: now,
    };
    try {
      await col.insertOne(doc);
      created++;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) updated++;
      else throw e;
    }
  }

  return { created, updated };
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
    const r = await upsertCasesForSurvey(survey as SurveyDoc);
    created += r.created;
    updated += r.updated;
  }
  return { surveys: sc, created, updated };
}
