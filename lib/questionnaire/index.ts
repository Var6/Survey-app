import type {
  Condition,
  Field,
  Label,
  RepeatGroup,
  Section,
  SectionItem,
} from "./types";
import { isRepeat } from "./types";
import { QUESTIONNAIRE, FORM_VERSION } from "./schema";

export * from "./types";
export * from "./settlements";
export { QUESTIONNAIRE, FORM_VERSION } from "./schema";

/** Prefer Hindi (field-facing); fall back to English while Hindi is unfilled. */
export function labelText(l: Label | { en: string; hi?: string }): string {
  return l.hi && l.hi.trim() ? l.hi : l.en;
}

/** Evaluate a skip-logic condition against a flat values map. */
export function evalCondition(
  cond: Condition | undefined,
  values: Record<string, unknown>
): boolean {
  if (!cond) return true;
  if ("any" in cond) return cond.any.some((c) => evalCondition(c, values));
  if ("all" in cond) return cond.all.every((c) => evalCondition(c, values));
  if ("expr" in cond) return !!cond.expr(values);

  const v = values[cond.field];
  if ("eq" in cond) return v === cond.eq;
  if ("ne" in cond) return v !== cond.ne;
  if ("in" in cond) return typeof v === "string" && cond.in.includes(v);

  const n = typeof v === "number" ? v : Number(v);
  if ("gt" in cond) return Number.isFinite(n) && n > cond.gt;
  if ("gte" in cond) return Number.isFinite(n) && n >= cond.gte;
  if ("lt" in cond) return Number.isFinite(n) && n < cond.lt;
  if ("lte" in cond) return Number.isFinite(n) && n <= cond.lte;
  return true;
}

export function isFieldVisible(
  field: Field,
  values: Record<string, unknown>
): boolean {
  return evalCondition(field.showWhen, values);
}

export function isFieldRequired(
  field: Field,
  values: Record<string, unknown>
): boolean {
  if (field.requiredWhen) return evalCondition(field.requiredWhen, values);
  return !!field.required;
}

export function isSectionVisible(
  section: Section,
  values: Record<string, unknown>
): boolean {
  return evalCondition(section.showWhen, values);
}

/** All top-level (non-repeat) fields across the questionnaire. */
export function allTopLevelFields(): Field[] {
  const out: Field[] = [];
  for (const section of QUESTIONNAIRE) {
    for (const item of section.items) {
      if (!isRepeat(item) && item.type !== "note") out.push(item);
    }
  }
  return out;
}

export function findField(name: string): Field | undefined {
  for (const section of QUESTIONNAIRE) {
    for (const item of section.items) {
      if (isRepeat(item)) {
        const f = item.fields.find((x) => x.name === name);
        if (f) return f;
      } else if (item.name === name) {
        return item;
      }
    }
  }
  return undefined;
}

export function repeatGroups(): RepeatGroup[] {
  const out: RepeatGroup[] = [];
  for (const section of QUESTIONNAIRE) {
    for (const item of section.items) {
      if (isRepeat(item)) out.push(item);
    }
  }
  return out;
}

/**
 * Validate a single field's value. Returns an error string or null.
 * Only validates fields that are currently visible + required.
 */
export function validateField(
  field: Field,
  value: unknown,
  values: Record<string, unknown>
): string | null {
  const visible = isFieldVisible(field, values);
  if (!visible) return null;

  const required = isFieldRequired(field, values);
  const empty =
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);

  if (required && empty) return "यह ज़रूरी है";
  if (empty) return null;

  const v = field.validation;
  if (field.type === "integer" || field.type === "decimal") {
    const n = Number(value);
    if (!Number.isFinite(n)) return "सही संख्या दर्ज करें";
    if (field.type === "integer" && !Number.isInteger(n))
      return "पूरी संख्या दर्ज करें";
    if (v?.min !== undefined && n < v.min) return `कम से कम ${v.min}`;
    if (v?.max !== undefined && n > v.max) return `ज़्यादा से ज़्यादा ${v.max}`;
  }

  if (field.type === "phone" && v?.digits) {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length !== v.digits)
      return `${v.digits} अंकों का फ़ोन नंबर दर्ज करें`;
  }

  if (field.type === "multiselect" && Array.isArray(value)) {
    if (v?.maxSelect && value.length > v.maxSelect)
      return `ज़्यादा से ज़्यादा ${v.maxSelect} चुनें`;
  }

  if (
    field.type === "select" &&
    field.options &&
    typeof value === "string" &&
    !field.options.some((o) => o.code === value)
  ) {
    return "गलत चयन";
  }

  return null;
}

export type { SectionItem };
