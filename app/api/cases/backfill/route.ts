import { json, handleError, requireRoles } from "@/lib/api";
import { ensureIndexes } from "@/lib/models";
import { backfillAllCases } from "@/lib/cases/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  try {
    await requireRoles("director", "mis", "programme_manager");
    await ensureIndexes();
    const result = await backfillAllCases();
    return json({ ok: true, ...result });
  } catch (e) {
    return handleError(e);
  }
}
