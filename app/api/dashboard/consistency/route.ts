import { json, handleError, requireRoles } from "@/lib/api";
import { runConsistencyChecks } from "@/lib/dashboard/consistency";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Does every number that appears in more than one place agree? */
export async function GET() {
  try {
    await requireRoles("director", "mis", "programme_manager");
    return json(await runConsistencyChecks());
  } catch (e) {
    return handleError(e);
  }
}
