/**
 * Questionnaire schema types.
 *
 * IMPORTANT: The field-facing language is Hindi. The source PDF's Hindi text
 * did not extract cleanly, so every label carries both `en` (English, filled)
 * and `hi` (Hindi, to be filled from the authoritative questionnaire). The UI
 * should prefer `hi` and fall back to `en` while Hindi is still empty.
 */

export type FieldType =
  | "text"
  | "textarea"
  | "integer"
  | "decimal"
  | "phone"
  | "date"
  | "time"
  | "select"
  | "multiselect"
  | "geopoint"
  | "note";

export interface Label {
  en: string;
  hi?: string;
}

export interface Option {
  code: string; // backend value stored in the DB
  en: string; // English label
  hi?: string; // Hindi label (field-facing) — to be filled
}

export interface Validation {
  min?: number;
  max?: number;
  /** cap this integer at the current value of another field (e.g. household size) */
  maxFrom?: string;
  /** exact number of digits (e.g. phone = 10) */
  digits?: number;
  /** max selections for multiselect */
  maxSelect?: number;
}

/* ── Skip-logic condition DSL ───────────────────────────────── */
export type Condition =
  | { field: string; eq: string | number | boolean }
  | { field: string; ne: string | number | boolean }
  | { field: string; in: string[] }
  | { field: string; gt: number }
  | { field: string; gte: number }
  | { field: string; lt: number }
  | { field: string; lte: number }
  | { any: Condition[] }
  | { all: Condition[] }
  /** escape hatch for compound expressions (e.g. summed counts) */
  | { expr: (values: Record<string, unknown>) => boolean };

export interface Field {
  qid: string; // "A1", "C7", ...
  name: string; // web-app variable / backend key
  label: Label;
  type: FieldType;
  options?: Option[];
  required?: boolean;
  /** required only when this condition is met (e.g. age >= 15) */
  requiredWhen?: Condition;
  /** field is shown only when this condition is met */
  showWhen?: Condition;
  validation?: Validation;
  /** enumerator/developer note shown as helper text */
  note?: string;
  defaultValue?: unknown;
}

export interface RepeatGroup {
  kind: "repeat";
  qid: string;
  name: string; // repeat group key (household_members, ...)
  label: Label;
  /** variable whose integer value sets the repeat count */
  countFrom: string;
  showWhen?: Condition;
  fields: Field[];
}

export type SectionItem = Field | RepeatGroup;

export interface Section {
  id: string; // "A" ... "O"
  title: Label;
  showWhen?: Condition;
  items: SectionItem[];
}

export function isRepeat(item: SectionItem): item is RepeatGroup {
  return (item as RepeatGroup).kind === "repeat";
}
