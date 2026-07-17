import { ObjectId } from "mongodb";
import { json, handleError, requireUser, readJson } from "@/lib/api";
import {
  surveysCol,
  projectsCol,
  ensureIndexes,
  nextSequence,
  type SurveyDoc,
  type SurveyStatus,
} from "@/lib/models";
import { buildSurveyFilter, attachMobiliserNames } from "@/lib/surveys";
import { publicSurvey } from "@/lib/serialize";
import { SETTLEMENT_BY_CODE } from "@/lib/questionnaire/settlements";
import { FORM_VERSION } from "@/lib/questionnaire";
import { frappeConfigured, syncSurveyById } from "@/lib/frappe";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const params = new URL(req.url).searchParams;
    const filter = buildSurveyFilter(user, params);
    const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 200);
    const skip = Math.max(Number(params.get("skip")) || 0, 0);

    const surveys = await surveysCol();
    const [docs, total] = await Promise.all([
      surveys.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
      surveys.countDocuments(filter),
    ]);

    const withNames = await attachMobiliserNames(docs);
    return json({
      surveys: withNames.map(({ survey, mobiliserName }) =>
        publicSurvey(survey, { mobiliserName })
      ),
      total,
      limit,
      skip,
    });
  } catch (e) {
    return handleError(e);
  }
}

interface SubmitBody {
  settlementCode?: string;
  mobiliserCode?: string;
  projectId?: string;
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

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await ensureIndexes();
    const body = await readJson<SubmitBody>(req);
    const data = body.data || {};

    const settlementCode =
      body.settlementCode || (data.settlement_name as string) || "";
    const settlement = SETTLEMENT_BY_CODE[settlementCode];
    if (!settlement) {
      return json({ error: "Select a valid settlement" }, 400);
    }

    // Resolve the project.
    const projects = await projectsCol();
    let projectId: ObjectId | null = user.projectId ?? null;
    if (user.role === "director") {
      if (body.projectId) {
        try {
          projectId = new ObjectId(body.projectId);
        } catch {
          return json({ error: "Invalid projectId" }, 400);
        }
      } else {
        const first = await projects.findOne({}, { sort: { createdAt: 1 } });
        projectId = first?._id ?? null;
      }
    }
    if (!projectId) {
      return json(
        { error: "No project available. Create a project first." },
        400
      );
    }

    const mobiliserCode =
      user.role === "cm"
        ? user.mobiliserCode || body.mobiliserCode
        : body.mobiliserCode || (data.mobiliser_code as string);

    // Ensure mobiliser fields are recorded in the data blob.
    if (user.role === "cm") {
      data.mobiliser_name = data.mobiliser_name || user.name;
      data.mobiliser_code = data.mobiliser_code || mobiliserCode;
    }

    // Household ID: <settlement prefix>-<mobiliser code>-<serial>
    const seq = await nextSequence(`hh:${settlementCode}`);
    const householdId = `${settlement.hhPrefix}-${mobiliserCode || "XX"}-${String(
      seq
    ).padStart(4, "0")}`;

    const now = new Date();
    const doc: SurveyDoc = {
      projectId,
      mobiliserId: user._id!,
      mobiliserCode: mobiliserCode || undefined,
      settlementCode,
      householdId,
      formVersion: body.formVersion || FORM_VERSION,
      status: body.status || "complete",
      data,
      members: body.members || [],
      children_0_3: body.children_0_3 || [],
      children_4_12: body.children_4_12 || [],
      youth_13_24: body.youth_13_24 || [],
      gps: body.gps ?? null,
      images: body.images ?? [],
      sync: { status: "pending", attempts: 0 },
      submittedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    const surveys = await surveysCol();
    const res = await surveys.insertOne(doc);

    // Best-effort, non-blocking push to Frappe (the mobiliser is never blocked).
    if (frappeConfigured()) {
      void syncSurveyById(res.insertedId).catch(() => {});
    }

    return json(
      {
        survey: publicSurvey({ ...doc, _id: res.insertedId }, {
          mobiliserName: user.name,
        }),
      },
      201
    );
  } catch (e) {
    return handleError(e);
  }
}
