import { ObjectId } from "mongodb";
import { json, handleError, requireUser, requireDirector } from "@/lib/api";
import { surveysCol, usersCol, casesCol } from "@/lib/models";
import { publicSurvey } from "@/lib/serialize";

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
