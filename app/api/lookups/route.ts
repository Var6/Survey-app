import { json, handleError, requireUser, requireRoles, readJson, HttpError } from "@/lib/api";
import { addLookup, listLookups } from "@/lib/lookups";
import type { LookupDoc } from "@/lib/models";

export const runtime = "nodejs";

const LISTS: LookupDoc["list"][] = ["camp_type", "meeting_type"];
const parseList = (v: unknown) => {
  if (!LISTS.includes(v as LookupDoc["list"])) throw new HttpError(400, "Unknown list");
  return v as LookupDoc["list"];
};

export async function GET(req: Request) {
  try {
    await requireUser();
    const list = parseList(new URL(req.url).searchParams.get("list"));
    const items = await listLookups(list);
    return json({ items: items.map((i) => ({ key: i.key, label: i.label })) });
  } catch (e) {
    return handleError(e);
  }
}

/** Add a camp / meeting type. */
export async function POST(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager");
    const body = await readJson<{ list?: string; label?: string }>(req);
    const item = await addLookup(parseList(body.list), String(body.label ?? ""), user._id);
    return json({ item: { key: item.key, label: item.label } }, 201);
  } catch (e) {
    if (e instanceof Error && e.message === "Enter a name for the type") {
      return handleError(new HttpError(400, e.message));
    }
    return handleError(e);
  }
}
