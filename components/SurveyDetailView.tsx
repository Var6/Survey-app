import {
  QUESTIONNAIRE,
  labelText,
  isRepeat,
  type Field,
  type RepeatGroup,
} from "@/lib/questionnaire";
import { SETTLEMENT_BY_CODE } from "@/lib/questionnaire/settlements";
import { formatDate } from "@/lib/client";
import { Badge } from "@/components/ui";
import type { SurveyDetail } from "@/lib/surveys";

type Values = Record<string, unknown>;

/** Repeat-group name → which SurveyDetail array holds its rows. */
const GROUP_ROWS: Record<string, keyof Pick<SurveyDetail, "members" | "children_0_3" | "children_4_12" | "youth_13_24">> = {
  household_members: "members",
  children_0_3: "children_0_3",
  children_4_12: "children_4_12",
  youth_13_24: "youth_13_24",
};

function optLabel(field: Field, code: string): string {
  const op = field.options?.find((o) => o.code === code);
  return op ? (op.hi && op.hi.trim() ? op.hi : op.en) : code;
}

/** Human-readable value for a field; null when unanswered. */
function displayValue(field: Field, values: Values): string | null {
  const val = values[field.name];
  if (val === null || val === undefined || val === "") return null;
  let text: string;
  if (field.type === "multiselect" && Array.isArray(val)) {
    if (val.length === 0) return null;
    text = val.map((c) => optLabel(field, String(c))).join(", ");
  } else if (field.type === "select") {
    text = optLabel(field, String(val));
  } else if (field.type === "geopoint") {
    const g = val as { lat?: number; lng?: number };
    if (typeof g?.lat !== "number" || typeof g?.lng !== "number") return null;
    text = `${g.lat.toFixed(5)}, ${g.lng.toFixed(5)}`;
  } else {
    text = String(val);
  }
  // "Other — please specify" free text recorded next to the field.
  const other = values[`${field.name}_other`];
  if (other) text += ` (${String(other)})`;
  return text;
}

function AnswerRows({ fields, values }: { fields: Field[]; values: Values }) {
  const rows = fields
    .filter((f) => f.type !== "note")
    .map((f) => {
      const value = displayValue(f, values);
      return value ? { key: f.name, label: labelText(f.label), value } : null;
    })
    .filter(Boolean) as { key: string; label: string; value: string }[];
  if (rows.length === 0) return null;
  return (
    <dl className="space-y-1.5">
      {rows.map((r) =>
        r.value.length > 55 ? (
          <div key={r.key} className="text-sm">
            <dt className="text-zinc-500">{r.label}</dt>
            <dd className="whitespace-pre-wrap font-medium text-zinc-800 dark:text-zinc-200 print:text-black">
              {r.value}
            </dd>
          </div>
        ) : (
          <div key={r.key} className="flex justify-between gap-3 text-sm">
            <dt className="text-zinc-500">{r.label}</dt>
            <dd className="text-right font-medium text-zinc-800 dark:text-zinc-200 print:text-black">
              {r.value}
            </dd>
          </div>
        )
      )}
    </dl>
  );
}

function RepeatBlock({ group, rows }: { group: RepeatGroup; rows: Values[] }) {
  const filled = rows.filter((r) => r && Object.keys(r).length > 0);
  if (filled.length === 0) return null;
  return (
    <div className="space-y-2">
      {filled.map((row, i) => (
        <div
          key={i}
          className="rounded-lg border border-zinc-200 p-2.5 dark:border-zinc-800 print:break-inside-avoid"
        >
          <p className="mb-1.5 text-xs font-semibold text-teal-700 dark:text-teal-400 print:text-black">
            {labelText(group.label)} #{i + 1}
          </p>
          <AnswerRows fields={group.fields} values={row} />
        </div>
      ))}
    </div>
  );
}

const cardClass =
  "rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 print:border-zinc-300 print:bg-white print:break-inside-avoid";

/** Full read-only render of one survey — screen and print/PDF friendly. */
export default function SurveyDetailView({ survey }: { survey: SurveyDetail }) {
  const d = survey.data;
  const settlement = SETTLEMENT_BY_CODE[survey.settlementCode];

  return (
    <div className="space-y-4 print:space-y-3 print:text-black">
      {/* Header card — doubles as the PDF letterhead. */}
      <div className={cardClass}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-400 print:text-black">
              जनमन · Household Baseline Survey
            </p>
            <h2 className="mt-0.5 text-xl font-bold text-zinc-900 dark:text-zinc-50 print:text-black">
              {(d.head_name as string) || "—"}
            </h2>
            <p className="text-sm text-zinc-500">
              {survey.householdId} · {settlement?.label || survey.settlementCode}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <Badge value={survey.status} />
            <Badge value={survey.sync.status} />
          </div>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-zinc-400">Mobiliser</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-200 print:text-black">
              {survey.mobiliserName || (d.mobiliser_name as string) || "—"}
              {survey.mobiliserCode ? ` (${survey.mobiliserCode})` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">Survey date</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-200 print:text-black">
              {(d.survey_date as string) || formatDate(survey.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">Ward</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-200 print:text-black">
              {d.ward_number != null && d.ward_number !== "" ? String(d.ward_number) : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">Interview time</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-200 print:text-black">
              {(d.interview_start_time as string) || "—"}
              {d.interview_end_time ? ` – ${d.interview_end_time}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">GPS</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-200 print:text-black">
              {survey.gps ? `${survey.gps.lat.toFixed(5)}, ${survey.gps.lng.toFixed(5)}` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-400">Form / Frappe</dt>
            <dd className="font-medium text-zinc-800 dark:text-zinc-200 print:text-black">
              {survey.formVersion}
              {survey.sync.frappeId ? ` · ${survey.sync.frappeId}` : ""}
            </dd>
          </div>
        </dl>
      </div>

      {/* All questionnaire sections, schema-driven. */}
      {QUESTIONNAIRE.map((section) => {
        // Build the section's blocks in order, tracking whether anything is answered.
        let hasContent = false;
        const parts: React.ReactNode[] = [];
        const flush = (fields: Field[]) => {
          if (!fields.length) return;
          if (fields.some((f) => f.type !== "note" && displayValue(f, d))) {
            hasContent = true;
            parts.push(<AnswerRows key={`f-${parts.length}`} fields={fields} values={d} />);
          }
        };
        let flat: Field[] = [];
        for (const item of section.items) {
          if (isRepeat(item)) {
            flush(flat);
            flat = [];
            const rowsKey = GROUP_ROWS[item.name];
            const rows = rowsKey ? (survey[rowsKey] as Values[]) : [];
            if (rows.some((r) => r && Object.keys(r).length > 0)) {
              hasContent = true;
              parts.push(<RepeatBlock key={item.name} group={item} rows={rows} />);
            }
          } else {
            flat.push(item);
          }
        }
        flush(flat);
        if (!hasContent) return null;
        return (
          <section key={section.id} className={cardClass}>
            <div className="mb-2 flex items-center gap-2 border-b border-zinc-200 pb-1.5 dark:border-zinc-800">
              <span className="flex h-6 w-6 items-center justify-center rounded bg-teal-100 text-xs font-bold text-teal-800 dark:bg-teal-900/40 dark:text-teal-300 print:bg-white print:text-black print:ring-1 print:ring-zinc-400">
                {section.id}
              </span>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 print:text-black">
                {labelText(section.title)}
              </h3>
            </div>
            <div className="space-y-3">{parts}</div>
          </section>
        );
      })}

      {/* Attached photos (consent etc.). */}
      {survey.images.length > 0 && (
        <div className={cardClass}>
          <h3 className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-50 print:text-black">
            Photos
          </h3>
          <div className="flex flex-wrap gap-2">
            {survey.images.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.key}
                src={img.url}
                alt={img.kind || "photo"}
                className="h-28 w-28 rounded-lg object-cover print:h-32 print:w-32"
              />
            ))}
          </div>
        </div>
      )}

      <p className="text-center text-xs text-zinc-400 print:text-zinc-600">
        {survey.householdId} · Submitted {formatDate(survey.submittedAt || survey.createdAt)} ·
        Last updated {formatDate(survey.updatedAt)}
      </p>
    </div>
  );
}
