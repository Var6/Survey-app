import { json, handleError, requireRoles, HttpError } from "@/lib/api";
import { campsCol } from "@/lib/models";
import { publicCamp } from "@/lib/serialize";
import { syncCampToCalendar } from "@/lib/gcal";
import { cmNameMap, oidOr400 } from "@/lib/schedule";

export const runtime = "nodejs";

/** Retry the Google Calendar sync for one camp (safe to repeat — same event id). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRoles("director", "mis", "programme_manager");
    const id = oidOr400((await ctx.params).id, "camp id");
    const col = await campsCol();
    if (!(await col.findOne({ _id: id }, { projection: { _id: 1 } }))) throw new HttpError(404, "Camp not found");
    const calendar = await syncCampToCalendar(id);
    const camp = (await col.findOne({ _id: id }))!;
    return json({ camp: publicCamp(camp, { cmNames: await cmNameMap(camp.assignedCmIds) }), calendar });
  } catch (e) {
    return handleError(e);
  }
}
