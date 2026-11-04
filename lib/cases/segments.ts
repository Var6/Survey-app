import type { Filter } from "mongodb";
import type { CaseDoc } from "@/lib/models";
import type { CaseModule } from "./modules";

/**
 * The dashboard's headline groups. Each one is defined HERE, once, as a case
 * filter — the dashboard tile, the module list it links to and the export all
 * use this definition, so they cannot disagree.
 *
 * Education (children aged 4–12):
 *   Out-of-school  = never enrolled + enrolled but not attending
 *   Dropout        = enrolled once and left
 *   (irregular attendance and other education needs stay in the module only)
 * Together the two equal the old combined "Out-of-school" figure.
 *
 * Maternal (the survey asks about pregnant or lactating women in section H):
 *   Pregnant women     = pregnancy_month is 1–3, 4–6 or 7–9
 *   Mothers w/ newborn = delivered recently (lactating, last 6 months)
 *   Not classified     = month unknown/not given, or cases created before
 *                        this split — "Generate from surveys" re-classifies them
 */
export type SegmentKey =
  | "out_of_school"
  | "dropout"
  | "pregnant"
  | "newborn_mother"
  | "maternal_unspecified";

export interface SegmentDef {
  key: SegmentKey;
  module: CaseModule;
  label: string;
  hint: string;
}

export const SEGMENTS: SegmentDef[] = [
  {
    key: "out_of_school",
    module: "education",
    label: "Out-of-school children",
    hint: "Never enrolled, or enrolled but not attending",
  },
  {
    key: "dropout",
    module: "education",
    label: "Dropout children",
    hint: "Enrolled earlier and left school",
  },
  {
    key: "pregnant",
    module: "maternal",
    label: "Pregnant women",
    hint: "Currently pregnant",
  },
  {
    key: "newborn_mother",
    module: "maternal",
    label: "Mothers with newborn",
    hint: "Delivered recently (last 6 months)",
  },
  {
    key: "maternal_unspecified",
    module: "maternal",
    label: "Maternal — not classified",
    hint: "Pregnancy month not recorded",
  },
];

export const SEGMENT_BY_KEY: Record<string, SegmentDef> = Object.fromEntries(
  SEGMENTS.map((s) => [s.key, s])
);

export const OUT_OF_SCHOOL_SUBCATEGORIES = ["never_enrolled", "not_attending"];
export const DROPOUT_SUBCATEGORIES = ["dropped_out"];

export function isSegmentKey(v: unknown): v is SegmentKey {
  return typeof v === "string" && v in SEGMENT_BY_KEY;
}

/** Mongo filter for one segment. */
export function segmentFilter(key: SegmentKey): Filter<CaseDoc> {
  switch (key) {
    case "out_of_school":
      return { module: "education", subcategory: { $in: OUT_OF_SCHOOL_SUBCATEGORIES } };
    case "dropout":
      return { module: "education", subcategory: { $in: DROPOUT_SUBCATEGORIES } };
    case "pregnant":
      return { module: "maternal", segment: "pregnant" };
    case "newborn_mother":
      return { module: "maternal", segment: "newborn_mother" };
    case "maternal_unspecified":
      // `segment: null` also matches cases that predate the field.
      return {
        module: "maternal",
        $or: [{ segment: null }, { segment: "maternal_unspecified" }],
      } as Filter<CaseDoc>;
  }
}

/** Classify the maternal case a survey produces. */
export function maternalSegment(d: Record<string, unknown>): SegmentKey {
  const m = String(d.pregnancy_month ?? "");
  if (["m1_3", "m4_6", "m7_9"].includes(m)) return "pregnant";
  if (m === "delivered_recently") return "newborn_mother";
  return "maternal_unspecified";
}
