import { json, handleError, requireRoles } from "@/lib/api";
import { computeDashboardMetrics } from "@/lib/dashboard/metrics";

export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await requireRoles("director", "mis", "accountant", "programme_manager");
    const metrics = await computeDashboardMetrics(user);
    return json({ metrics, at: new Date().toISOString() });
  } catch (e) {
    return handleError(e);
  }
}
