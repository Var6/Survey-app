import { ObjectId } from "mongodb";
import { surveysCol, usersCol, type SurveyDoc, type UserDoc } from "./models";

/** Build a Mongo filter for surveys, scoping CMs to their own records. */
export function buildSurveyFilter(
  user: UserDoc,
  params: URLSearchParams
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  if (user.role === "cm") {
    filter.mobiliserId = user._id;
  } else {
    const mob = params.get("mobiliserId");
    if (mob) {
      try {
        filter.mobiliserId = new ObjectId(mob);
      } catch {
        /* ignore */
      }
    }
  }

  const settlement = params.get("settlement");
  if (settlement) filter.settlementCode = settlement;

  const status = params.get("status");
  if (status) filter.status = status;

  const sync = params.get("sync"); // synced | unsynced | failed | pending
  if (sync === "synced") filter["sync.status"] = "synced";
  else if (sync === "unsynced") filter["sync.status"] = { $ne: "synced" };
  else if (sync) filter["sync.status"] = sync;

  return filter;
}

/** Attach the mobiliser display name to each survey via one batched query. */
export async function attachMobiliserNames(
  surveys: SurveyDoc[]
): Promise<{ survey: SurveyDoc; mobiliserName?: string }[]> {
  const ids = [...new Set(surveys.map((s) => String(s.mobiliserId)))];
  if (ids.length === 0) return [];
  const users = await usersCol();
  const docs = await users
    .find({ _id: { $in: ids.map((i) => new ObjectId(i)) } })
    .toArray();
  const nameById = new Map(docs.map((u) => [String(u._id), u.name]));
  return surveys.map((survey) => ({
    survey,
    mobiliserName: nameById.get(String(survey.mobiliserId)),
  }));
}

export async function surveysCollection() {
  return surveysCol();
}
