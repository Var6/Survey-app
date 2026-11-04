import { json, handleError, requireRoles } from "@/lib/api";
import { caseFacets, parseCaseQuery } from "@/lib/cases/query";

export const runtime = "nodejs";

/**
 * Filter counts over the WHOLE matching dataset — not just the page on screen.
 * Each dimension is counted with its own filter cleared, so a dropdown always
 * shows what choosing each option would give.
 */
export async function GET(req: Request) {
  try {
    const user = await requireRoles("director", "mis", "programme_manager", "cm");
    const q = parseCaseQuery(new URL(req.url).searchParams);
    return json({ facets: await caseFacets(user, q) });
  } catch (e) {
    return handleError(e);
  }
}
