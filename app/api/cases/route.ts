import { ObjectId } from "mongodb";
import { json, handleError, requireRoles } from "@/lib/api";
import { usersCol } from "@/lib/models";
import { publicCase } from "@/lib/serialize";
import { buildCaseFilter, listCases, parseCaseQuery, parsePaging } from "@/lib/cases/query";

export const runtime = "nodejs";

/**
 * Paged case list. Filtering, sorting, counting and paging all happen in
 * MongoDB — the browser only ever receives one page (100 by default).
 * Community Mobilisers get the same endpoint, scoped to their own cases.
 */
export async function GET(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const p = new URL(req.url).searchParams;
    const q = parseCaseQuery(p);
    const paging = parsePaging(p);

    const filter = await buildCaseFilter(user, q);
    const { docs, total } = await listCases(filter, paging);

    const cmIds = [
      ...new Set(docs.map((c) => String(c.assignedCmId ?? c.mobiliserId ?? "")).filter(Boolean)),
    ].map((id) => new ObjectId(id));
    const names = new Map<string, string>();
    if (cmIds.length) {
      const users = await (await usersCol())
        .find({ _id: { $in: cmIds } }, { projection: { name: 1 } })
        .toArray();
      for (const u of users) names.set(String(u._id), u.name);
    }

    return json({
      cases: docs.map((c) =>
        publicCase(c, { assignedCmName: names.get(String(c.assignedCmId ?? c.mobiliserId)) })
      ),
      total,
      page: paging.page,
      pageSize: paging.pageSize,
      pages: Math.max(Math.ceil(total / paging.pageSize), 1),
    });
  } catch (e) {
    return handleError(e);
  }
}
