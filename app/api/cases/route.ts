import { json, handleError, requireRoles } from "@/lib/api";
import { casesCol } from "@/lib/models";
import { publicCase } from "@/lib/serialize";
import { PRIORITY_ORDER } from "@/lib/cases/modules";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    await requireRoles("director", "mis", "programme_manager");
    const url = new URL(req.url);
    const p = url.searchParams;
    const module = p.get("module") || undefined;
    const status = p.get("status") || "open"; // open | closed | overdue | all
    const subcategory = p.get("subcategory") || undefined;
    const settlement = p.get("settlement") || undefined;
    const priority = p.get("priority") || undefined;
    const q = (p.get("q") || "").trim();
    const limit = Math.min(Number(p.get("limit")) || 300, 500);
    const today = new Date().toISOString().slice(0, 10);

    const filter: Record<string, unknown> = {};
    if (module) filter.module = module;
    if (subcategory) filter.subcategory = subcategory;
    if (settlement) filter.settlementCode = settlement;
    if (priority) filter.priority = priority;
    if (status === "open") filter.closed = false;
    else if (status === "closed") filter.closed = true;
    else if (status === "overdue") {
      filter.closed = false;
      filter.dueDate = { $gt: "", $lt: today };
    }
    if (q) {
      filter.$or = [
        { caseId: { $regex: q, $options: "i" } },
        { subjectName: { $regex: q, $options: "i" } },
        { householdId: { $regex: q, $options: "i" } },
        { title: { $regex: q, $options: "i" } },
      ];
    }

    const col = await casesCol();
    const docs = await col.find(filter).limit(limit).toArray();
    // Sort: open first, then by priority, overdue due dates, newest.
    docs.sort((a, b) => {
      if (a.closed !== b.closed) return a.closed ? 1 : -1;
      const pr = PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
      if (pr !== 0) return pr;
      const ad = a.dueDate || "9999";
      const bd = b.dueDate || "9999";
      if (ad !== bd) return ad < bd ? -1 : 1;
      return b.createdAt > a.createdAt ? 1 : -1;
    });
    return json({ cases: docs.map((c) => publicCase(c)) });
  } catch (e) {
    return handleError(e);
  }
}
