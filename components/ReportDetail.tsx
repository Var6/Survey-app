import { labelText, type Field } from "@/lib/questionnaire";
import { REPORT_SECTIONS } from "@/lib/reports/schema";

function optLabel(field: Field, code: string): string {
  const op = field.options?.find((o) => o.code === code);
  return op ? op.hi || op.en : code;
}

function displayValue(field: Field, val: unknown): string | null {
  if (val === null || val === undefined || val === "") return null;
  if (field.type === "multiselect" && Array.isArray(val)) {
    if (val.length === 0) return null;
    return val.map((c) => optLabel(field, String(c))).join(", ");
  }
  if (field.type === "select") return optLabel(field, String(val));
  return String(val);
}

/** Read-only render of a submitted daily report's structured data. */
export default function ReportDetail({ data }: { data: Record<string, unknown> }) {
  return (
    <div className="mt-3 space-y-3">
      {REPORT_SECTIONS.map((section) => {
        const rows = section.items
          .map((f) => {
            const field = f as Field;
            const value = displayValue(field, data[field.name]);
            return value ? { label: labelText(field.label), value } : null;
          })
          .filter(Boolean) as { label: string; value: string }[];
        if (rows.length === 0) return null;
        return (
          <div key={section.id}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {labelText(section.title)}
            </p>
            <dl className="space-y-1">
              {rows.map((r) => (
                <div key={r.label} className="flex justify-between gap-3 text-sm">
                  <dt className="text-zinc-500">{r.label}</dt>
                  <dd className="text-right font-medium text-zinc-800 dark:text-zinc-200">
                    {r.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        );
      })}
    </div>
  );
}
