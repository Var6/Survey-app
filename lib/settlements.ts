import { settlementsCol, type SettlementDoc } from "./models";
import { SETTLEMENTS as SEED } from "./questionnaire/settlements";

/**
 * The live community list. Seeded once from lib/questionnaire/settlements.ts,
 * then managed in the app by the Director, Programme Manager or MIS.
 */

/** Create the collection's rows the first time the app looks for them. */
export async function ensureSettlementsSeeded(): Promise<void> {
  const col = await settlementsCol();
  if ((await col.countDocuments({})) > 0) return;
  const now = new Date();
  await col.insertMany(
    SEED.map((s, i) => ({
      code: s.code,
      label: s.label,
      hhPrefix: s.hhPrefix,
      active: true,
      order: i,
      createdAt: now,
      updatedAt: now,
    }))
  );
}

export async function listSettlements(
  opts: { includeInactive?: boolean } = {}
): Promise<SettlementDoc[]> {
  await ensureSettlementsSeeded();
  const col = await settlementsCol();
  const filter = opts.includeInactive ? {} : { active: true };
  return col.find(filter).sort({ order: 1, label: 1 }).toArray();
}

/** code → label, for rendering stored survey/report data. */
export async function settlementLabels(): Promise<Record<string, string>> {
  const rows = await listSettlements({ includeInactive: true });
  return Object.fromEntries(rows.map((r) => [r.code, r.label]));
}

/** The shape the survey form and pickers expect. */
export async function settlementOptions(): Promise<
  { code: string; label: string }[]
> {
  const rows = await listSettlements();
  return rows.map((r) => ({ code: r.code, label: r.label }));
}

/** A URL/ID-safe code derived from the name the user typed. */
export function slugifyCode(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

/** Three-letter household-ID prefix suggestion, e.g. "Housing Board" → "HOU". */
export function suggestPrefix(label: string): string {
  const letters = label.toUpperCase().replace(/[^A-Z]/g, "");
  return (letters.slice(0, 3) || "XXX").padEnd(3, "X");
}

/** One community by its code, from the live list. */
export async function getSettlement(code: string): Promise<SettlementDoc | null> {
  if (!code) return null;
  await ensureSettlementsSeeded();
  const col = await settlementsCol();
  return col.findOne({ code });
}
