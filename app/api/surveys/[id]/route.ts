import { ObjectId } from "mongodb";
import { json, handleError, requireUser, requireDirector, readJson } from "@/lib/api";
import {
  surveysCol,
  usersCol,
  casesCol,
  nextSequence,
  type SurveyDoc,
  type SurveyStatus,
} from "@/lib/models";
import { publicSurvey } from "@/lib/serialize";
import { SETTLEMENT_BY_CODE } from "@/lib/questionnaire/settlements";
import { frappeConfigured, syncSurveyById } from "@/lib/frappe";
import { upsertCasesForSurvey } from "@/lib/cases/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }

    const surveys = await surveysCol();
    const survey = await surveys.findOne({ _id });
    if (!survey) return json({ error: "Survey not found" }, 404);

    if (user.role === "cm" && String(survey.mobiliserId) !== String(user._id)) {
      return json({ error: "Forbidden" }, 403);
    }

    const users = await usersCol();
    const mobiliser = await users.findOne({ _id: survey.mobiliserId });

    return json({
      survey: {
        ...publicSurvey(survey, { mobiliserName: mobiliser?.name }),
        formVersion: survey.formVersion,
        data: survey.data,
        members: survey.members ?? [],
        children_0_3: survey.children_0_3 ?? [],
        children_4_12: survey.children_4_12 ?? [],
        youth_13_24: survey.youth_13_24 ?? [],
        gps: survey.gps ?? null,
        images: survey.images ?? [],
      },
    });
  } catch (e) {
    return handleError(e);
  }
}

const STATUSES: SurveyStatus[] = ["complete", "partial", "refused_midway"];

interface PatchBody {
  settlementCode?: string;
  formVersion?: string;
  status?: SurveyStatus;
  data?: Record<string, unknown>;
  members?: Record<string, unknown>[];
  children_0_3?: Record<string, unknown>[];
  children_4_12?: Record<string, unknown>[];
  youth_13_24?: Record<string, unknown>[];
  gps?: { lat: number; lng: number; accuracy?: number } | null;
  images?: { key: string; url: string; kind?: string }[];
}

/**
 * Re-fill an incomplete survey (same household record, same household ID).
 * CMs can edit their own; office roles can edit any. Completed surveys are
 * locked. Frappe sync happens only when the survey is marked complete.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }

    const surveys = await surveysCol();
    const survey = await surveys.findOne({ _id });
    if (!survey) return json({ error: "Survey not found" }, 404);

    if (user.role === "cm" && String(survey.mobiliserId) !== String(user._id)) {
      return json({ error: "Forbidden" }, 403);
    }
    if (survey.status === "complete") {
      return json(
        { error: "पूरा हो चुका सर्वे बदला नहीं जा सकता / Completed surveys are locked" },
        400
      );
    }

    const body = await readJson<PatchBody>(req);
    const data = body.data || survey.data || {};

    // Settlement changed while re-filling → issue a fresh household ID with
    // the right prefix; otherwise the original household ID is kept.
    let settlementCode = survey.settlementCode;
    let householdId = survey.householdId;
    const newCode = body.settlementCode || (data.settlement_name as string) || "";
    if (newCode && newCode !== survey.settlementCode) {
      const settlement = SETTLEMENT_BY_CODE[newCode];
      if (!settlement) return json({ error: "Select a valid settlement" }, 400);
      const seq = await nextSequence(`hh:${newCode}`);
      householdId = `${settlement.hhPrefix}-${survey.mobiliserCode || "XX"}-${String(
        seq
      ).padStart(4, "0")}`;
      settlementCode = newCode;
    }

    const status: SurveyStatus = STATUSES.includes(body.status as SurveyStatus)
      ? (body.status as SurveyStatus)
      : survey.status;

    const now = new Date();
    const update: Partial<SurveyDoc> = {
      settlementCode,
      householdId,
      formVersion: body.formVersion || survey.formVersion,
      status,
      data,
      members: body.members ?? survey.members ?? [],
      children_0_3: body.children_0_3 ?? survey.children_0_3 ?? [],
      children_4_12: body.children_4_12 ?? survey.children_4_12 ?? [],
      youth_13_24: body.youth_13_24 ?? survey.youth_13_24 ?? [],
      gps: body.gps !== undefined ? body.gps : survey.gps ?? null,
      images: body.images ?? survey.images ?? [],
      updatedAt: now,
    };
    if (status === "complete") update.submittedAt = now;

    await surveys.updateOne({ _id }, { $set: update });
    const updated: SurveyDoc = { ...survey, ...update };

    // Push to Frappe + derive cases only once the survey is fully done.
    if (status === "complete") {
      if (frappeConfigured()) {
        void syncSurveyById(_id).catch(() => {});
      }
      void upsertCasesForSurvey(updated).catch(() => {});
    }

    return json({ survey: publicSurvey(updated, {}) });
  } catch (e) {
    return handleError(e);
  }
}

/** Director-only: delete a survey and the cases derived from it. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireDirector();
    const { id } = await ctx.params;
    let _id: ObjectId;
    try {
      _id = new ObjectId(id);
    } catch {
      return json({ error: "Invalid id" }, 400);
    }
    const surveys = await surveysCol();
    const res = await surveys.deleteOne({ _id });
    if (!res.deletedCount) return json({ error: "Survey not found" }, 404);
    const cases = await casesCol();
    await cases.deleteMany({ surveyId: _id });
    return json({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
