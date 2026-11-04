import { ObjectId } from "mongodb";
import { HttpError } from "./api";
import { usersCol } from "./models";
import { isDateStr, isTimeStr } from "./time";

export const clip = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/** Date + optional start/end time, validated together. */
export function checkWhen(input: { date?: unknown; startTime?: unknown; endTime?: unknown }) {
  const date = clip(input.date, 10);
  if (!isDateStr(date)) throw new HttpError(400, "Choose the date");
  const startTime = clip(input.startTime, 5) || undefined;
  const endTime = clip(input.endTime, 5) || undefined;
  if (startTime && !isTimeStr(startTime)) throw new HttpError(400, "Start time must look like 10:30");
  if (endTime && !isTimeStr(endTime)) throw new HttpError(400, "End time must look like 13:00");
  if (endTime && !startTime) throw new HttpError(400, "Add a start time before the end time");
  if (startTime && endTime && endTime <= startTime) {
    throw new HttpError(400, "End time must be after the start time");
  }
  return { date, startTime, endTime };
}

/** Parse a list of CM ids; every one must be an active Community Mobiliser. */
export async function resolveCmIds(raw: unknown, exclude?: ObjectId): Promise<ObjectId[]> {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) throw new HttpError(400, "Choose the Community Mobilisers from the list");
  if (raw.length > 100) throw new HttpError(400, "Too many Community Mobilisers selected");
  const ids: ObjectId[] = [];
  for (const v of raw) {
    try {
      const id = new ObjectId(String(v));
      if (exclude && String(id) === String(exclude)) continue;
      if (!ids.some((x) => String(x) === String(id))) ids.push(id);
    } catch {
      throw new HttpError(400, "Invalid Community Mobiliser");
    }
  }
  if (!ids.length) return [];
  const found = await (await usersCol()).countDocuments({
    _id: { $in: ids },
    role: "cm",
    active: { $ne: false },
  });
  if (found !== ids.length) throw new HttpError(400, "One of the selected people is not an active Community Mobiliser");
  return ids;
}

export async function cmNameMap(ids: ObjectId[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const docs = await (await usersCol())
    .find({ _id: { $in: ids } }, { projection: { name: 1 } })
    .toArray();
  return Object.fromEntries(docs.map((d) => [String(d._id), d.name]));
}

export function oidOr400(v: string, what = "id"): ObjectId {
  try {
    return new ObjectId(v);
  } catch {
    throw new HttpError(400, `Invalid ${what}`);
  }
}

/** "Tue, 4 Nov · 10:30–13:00" for notification text. */
export function whenText(date: string, start?: string, end?: string) {
  const d = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return start ? `${d}, ${start}${end ? `–${end}` : ""}` : d;
}
