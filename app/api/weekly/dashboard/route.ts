import { json, handleError, requireRoles } from "@/lib/api";
import { weekOf, computeDashboard } from "@/lib/weekly/dashboard";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requireRoles("programme_manager", "director", "mis");
    const { weekStart, weekEnd, reportId } = weekOf(new Date());
    const dashboard = await computeDashboard(weekStart, weekEnd);
    return json({ reportId, weekStart, weekEnd, dashboard });
  } catch (e) {
    return handleError(e);
  }
}
