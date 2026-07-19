"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch, formatMoney, formatDate } from "@/lib/client";
import {
  BUDGET_CATEGORIES,
  COST_CATEGORIES,
  UNIT_TYPES,
  budgetSummary,
  lineYearTotal,
  lineTotal,
  type PublicBudget,
} from "@/lib/budget";
import type { BudgetDoc, BudgetLine, BudgetCategory, InflationType } from "@/lib/models";
import { Card, Empty, inputClass, labelClass, btnPrimary, btnGhost } from "@/components/ui";

/** publicBudget shape is compatible with the pure computation helpers. */
const asDoc = (b: PublicBudget) => b as unknown as BudgetDoc;

const cellCls =
  "w-full rounded border border-zinc-200 bg-white px-1.5 py-1 text-right text-xs tabular-nums outline-none focus:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950";

export default function BudgetsClient() {
  const [budgets, setBudgets] = useState<PublicBudget[]>([]);
  const [sel, setSel] = useState<PublicBudget | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newYears, setNewYears] = useState(2);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { budgets } = await apiFetch<{ budgets: PublicBudget[] }>("/api/budgets");
      setBudgets(budgets);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!newName.trim()) return;
    try {
      const { budget } = await apiFetch<{ budget: PublicBudget }>("/api/budgets", {
        method: "POST",
        body: JSON.stringify({ name: newName.trim(), numYears: newYears }),
      });
      setCreating(false);
      setNewName("");
      setSel(budget);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (sel) {
    return (
      <BudgetEditor
        initial={sel}
        onBack={() => {
          setSel(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {creating ? (
        <Card>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Budget name</label>
              <input
                className={inputClass}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Revised Budget — Janman UIS (APF)"
              />
            </div>
            <div>
              <label className={labelClass}>Years</label>
              <select
                className={inputClass}
                value={newYears}
                onChange={(e) => setNewYears(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <button className={btnPrimary} onClick={create}>
              Create budget
            </button>
            <button className={btnGhost} onClick={() => setCreating(false)}>
              Cancel
            </button>
          </div>
        </Card>
      ) : (
        <button className={btnPrimary} onClick={() => setCreating(true)}>
          + New budget
        </button>
      )}

      {err && <p className="text-sm text-red-600">{err}</p>}
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : budgets.length === 0 ? (
        <Empty>No budgets yet. Create one to start.</Empty>
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => {
            const s = budgetSummary(asDoc(b));
            return (
              <Card key={b.id}>
                <button
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setSel(b)}
                >
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-zinc-50">{b.name}</p>
                    <p className="text-xs text-zinc-400">
                      {b.numYears} year{b.numYears > 1 ? "s" : ""} · updated {formatDate(b.updatedAt)}
                    </p>
                  </div>
                  <p className="text-lg font-bold tabular-nums text-teal-700 dark:text-teal-400">
                    {formatMoney(s.grandTotal, b.currency)}
                  </p>
                </button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Editor ────────────────────────────────────────────────────── */
function BudgetEditor({
  initial,
  onBack,
}: {
  initial: PublicBudget;
  onBack: () => void;
}) {
  const [b, setB] = useState<PublicBudget>(initial);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const doc = asDoc(b);
  const summary = useMemo(() => budgetSummary(doc), [doc]);
  const years = b.numYears;

  const setLine = (id: string, patch: Partial<BudgetLine>) =>
    setB((s) => ({
      ...s,
      lines: s.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  const setLineYear = (id: string, yi: number, key: "units" | "unitCost" | "allocPct", v: number) =>
    setB((s) => ({
      ...s,
      lines: s.lines.map((l) =>
        l.id === id
          ? {
              ...l,
              years: l.years.map((y, i) => (i === yi ? { ...y, [key]: v } : y)),
            }
          : l
      ),
    }));

  const addLine = (category: BudgetCategory) =>
    setB((s) => ({
      ...s,
      lines: [
        ...s.lines,
        {
          id: `${Date.now()}-${s.lines.length}`,
          category,
          description: "",
          inflation: category.startsWith("salary")
            ? ("salary" as InflationType)
            : category === "capex"
            ? ("nil" as InflationType)
            : ("other" as InflationType),
          unitType: category === "capex" ? "one-time" : "Month",
          years: Array.from({ length: years }, () => ({ units: 0, unitCost: 0, allocPct: 100 })),
        },
      ],
    }));
  const removeLine = (id: string) =>
    setB((s) => ({ ...s, lines: s.lines.filter((l) => l.id !== id) }));

  async function save() {
    setSaving(true);
    setErr(null);
    setMsg(null);
    try {
      const { budget } = await apiFetch<{ budget: PublicBudget }>(`/api/budgets/${b.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: b.name,
          numYears: b.numYears,
          inflationRates: b.inflationRates,
          lines: b.lines,
        }),
      });
      setB(budget);
      setMsg("Saved ✓");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!confirm("Delete this budget?")) return;
    try {
      await apiFetch(`/api/budgets/${b.id}`, { method: "DELETE" });
      onBack();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button className={btnGhost} onClick={onBack}>
          ← All budgets
        </button>
        <div className="flex flex-wrap gap-2">
          <a
            href={`/api/budgets/${b.id}/export`}
            className="rounded-lg border border-teal-600 px-3 py-2 text-sm font-semibold text-teal-700 transition hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/30"
          >
            ⬇ Export Excel
          </a>
          <button className={btnPrimary} onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save budget"}
          </button>
          <button
            className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
            onClick={remove}
          >
            Delete
          </button>
        </div>
      </div>

      {msg && <p className="text-sm text-teal-700 dark:text-teal-400">{msg}</p>}
      {err && <p className="text-sm text-red-600">{err}</p>}

      {/* Header settings */}
      <Card>
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="sm:col-span-2">
            <label className={labelClass}>Budget name</label>
            <input
              className={inputClass}
              value={b.name}
              onChange={(e) => setB((s) => ({ ...s, name: e.target.value }))}
            />
          </div>
          <div>
            <label className={labelClass}>Salary inflation %</label>
            <input
              className={inputClass}
              type="number"
              value={b.inflationRates.salary}
              onChange={(e) =>
                setB((s) => ({
                  ...s,
                  inflationRates: { ...s.inflationRates, salary: Number(e.target.value) || 0 },
                }))
              }
            />
          </div>
          <div>
            <label className={labelClass}>Other inflation %</label>
            <input
              className={inputClass}
              type="number"
              value={b.inflationRates.other}
              onChange={(e) =>
                setB((s) => ({
                  ...s,
                  inflationRates: { ...s.inflationRates, other: Number(e.target.value) || 0 },
                }))
              }
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          Inflation applies automatically from Year 2 (compounded). Nil lines never inflate.
        </p>
      </Card>

      {/* Live summary */}
      <Card>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Budget summary (auto)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-zinc-400">
              <tr>
                <th className="py-1.5 font-medium">Category</th>
                {Array.from({ length: years }, (_, i) => (
                  <th key={i} className="py-1.5 text-right font-medium">
                    Year {i + 1}
                  </th>
                ))}
                <th className="py-1.5 text-right font-medium">Total</th>
                <th className="py-1.5 text-right font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows.map((r) => (
                <tr key={r.key} className="border-t border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 text-zinc-700 dark:text-zinc-300">{r.label}</td>
                  {r.perYear.map((v, i) => (
                    <td key={i} className="py-1.5 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                      {v.toLocaleString("en-IN")}
                    </td>
                  ))}
                  <td className="py-1.5 text-right font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                    {r.total.toLocaleString("en-IN")}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-400">
                    {summary.grandTotal ? Math.round((r.total / summary.grandTotal) * 100) : 0}%
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-zinc-300 font-bold dark:border-zinc-700">
                <td className="py-2 text-zinc-900 dark:text-zinc-50">TOTAL</td>
                {summary.perYear.map((v, i) => (
                  <td key={i} className="py-2 text-right tabular-nums text-zinc-900 dark:text-zinc-50">
                    {v.toLocaleString("en-IN")}
                  </td>
                ))}
                <td className="py-2 text-right tabular-nums text-teal-700 dark:text-teal-400">
                  {summary.grandTotal.toLocaleString("en-IN")}
                </td>
                <td className="py-2 text-right text-zinc-400">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Category sections */}
      {BUDGET_CATEGORIES.map((cat) => {
        const lines = b.lines.filter((l) => l.category === cat.key);
        return (
          <Card key={cat.key}>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {cat.group}
                </p>
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">{cat.label}</p>
              </div>
              <button
                className="rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-teal-700"
                onClick={() => addLine(cat.key)}
              >
                + Add line
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="py-3 text-center text-xs text-zinc-400">No lines yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-xs">
                  <thead className="text-left uppercase tracking-wide text-zinc-400">
                    <tr>
                      <th className="w-56 py-1.5 pr-2 font-medium">Description</th>
                      {cat.staff && <th className="w-28 py-1.5 pr-2 font-medium">Cost cat.</th>}
                      <th className="w-20 py-1.5 pr-2 font-medium">Inflation</th>
                      <th className="w-24 py-1.5 pr-2 font-medium">Unit</th>
                      {Array.from({ length: years }, (_, i) => (
                        <th key={i} className="py-1.5 pr-2 text-center font-medium" colSpan={4}>
                          Year {i + 1} (units × cost × %)
                        </th>
                      ))}
                      <th className="py-1.5 pr-2 text-right font-medium">Total</th>
                      <th className="w-8 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l) => (
                      <LineRow
                        key={l.id}
                        line={l}
                        doc={doc}
                        years={years}
                        staff={!!cat.staff}
                        isProgram={cat.key === "program"}
                        onChange={(p) => setLine(l.id, p)}
                        onYearChange={(yi, k, v) => setLineYear(l.id, yi, k, v)}
                        onRemove={() => removeLine(l.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

const WORKING_FIELDS: { key: keyof NonNullable<BudgetLine["working"]>; label: string }[] = [
  { key: "food", label: "Food" },
  { key: "accommodation", label: "Accomodation" },
  { key: "resource", label: "Resource fee / Consultant" },
  { key: "iec", label: "IEC" },
  { key: "others", label: "Others" },
];

function LineRow({
  line,
  doc,
  years,
  staff,
  isProgram,
  onChange,
  onYearChange,
  onRemove,
}: {
  line: BudgetLine;
  doc: BudgetDoc;
  years: number;
  staff: boolean;
  isProgram: boolean;
  onChange: (p: Partial<BudgetLine>) => void;
  onYearChange: (yi: number, key: "units" | "unitCost" | "allocPct", v: number) => void;
  onRemove: () => void;
}) {
  const [showWorking, setShowWorking] = useState(
    !!line.working &&
      (Object.values(line.working).some((v) => typeof v === "number" && v > 0) ||
        !!line.working.assumptions)
  );
  const w = line.working || {};
  const workingTotal =
    (w.food || 0) + (w.accommodation || 0) + (w.resource || 0) + (w.iec || 0) + (w.others || 0);
  const setW = (patch: Partial<NonNullable<BudgetLine["working"]>>) =>
    onChange({ working: { ...w, ...patch } });
  return (
    <>
      <tr className="border-t border-zinc-100 align-top dark:border-zinc-900">
        <td className="py-1.5 pr-2">
          <input
            className={`${cellCls} text-left`}
            value={line.description}
            placeholder="Description"
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </td>
        {staff && (
          <td className="py-1.5 pr-2">
            <select
              className={`${cellCls} text-left`}
              value={line.costCategory || ""}
              onChange={(e) => onChange({ costCategory: e.target.value || undefined })}
            >
              <option value="">—</option>
              {COST_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </td>
        )}
        <td className="py-1.5 pr-2">
          <select
            className={`${cellCls} text-left`}
            value={line.inflation}
            onChange={(e) => onChange({ inflation: e.target.value as InflationType })}
          >
            <option value="salary">Salary</option>
            <option value="nil">Nil</option>
            <option value="other">Other</option>
          </select>
        </td>
        <td className="py-1.5 pr-2">
          <select
            className={`${cellCls} text-left`}
            value={line.unitType || ""}
            onChange={(e) => onChange({ unitType: e.target.value || undefined })}
          >
            <option value="">—</option>
            {UNIT_TYPES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>
        </td>
        {Array.from({ length: years }, (_, yi) => {
          const y = line.years[yi] || { units: 0, unitCost: 0, allocPct: 100 };
          return (
            <td key={yi} className="py-1.5 pr-2" colSpan={4}>
              <div className="flex items-center gap-1">
                <input
                  className={cellCls}
                  type="number"
                  value={y.units || ""}
                  placeholder="units"
                  onChange={(e) => onYearChange(yi, "units", Number(e.target.value) || 0)}
                />
                <span className="text-zinc-300">×</span>
                <input
                  className={cellCls}
                  type="number"
                  value={y.unitCost || ""}
                  placeholder="cost"
                  onChange={(e) => onYearChange(yi, "unitCost", Number(e.target.value) || 0)}
                />
                <span className="text-zinc-300">×</span>
                <input
                  className={cellCls}
                  type="number"
                  value={y.allocPct}
                  onChange={(e) => onYearChange(yi, "allocPct", Number(e.target.value) || 0)}
                />
                <span className="whitespace-nowrap font-semibold tabular-nums text-zinc-700 dark:text-zinc-300">
                  = {lineYearTotal(doc, line, yi).toLocaleString("en-IN")}
                </span>
              </div>
            </td>
          );
        })}
        <td className="py-1.5 pr-2 text-right font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
          {lineTotal(doc, line).toLocaleString("en-IN")}
        </td>
        <td className="py-1.5 text-right">
          <button
            className="rounded px-1.5 py-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
            onClick={onRemove}
            aria-label="Remove line"
          >
            ✕
          </button>
        </td>
      </tr>
      <tr className="align-top">
        <td colSpan={staff ? 4 : 3} className="pb-2 pr-2">
          <input
            className={`${cellCls} text-left`}
            value={line.notes || ""}
            placeholder="Budget notes / unit-cost justification"
            onChange={(e) => onChange({ notes: e.target.value || undefined })}
          />
        </td>
        <td className="pb-2 pr-2">
          {isProgram && (
            <button
              className="whitespace-nowrap rounded px-1.5 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-50 dark:text-teal-400 dark:hover:bg-teal-950/30"
              onClick={() => setShowWorking((s) => !s)}
            >
              {showWorking ? "▾ Working" : "▸ Working"}
            </button>
          )}
        </td>
        <td colSpan={years * 4 + 2} />
      </tr>
      {isProgram && showWorking && (
        <tr className="align-top">
          <td colSpan={years * 4 + (staff ? 7 : 6)} className="pb-3 pr-2">
            <div className="rounded-lg bg-zinc-50 p-2.5 dark:bg-zinc-900">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                Working sheet — cost break-up
              </p>
              <div className="flex flex-wrap items-end gap-2">
                {WORKING_FIELDS.map((f) => (
                  <label key={f.key} className="block">
                    <span className="mb-0.5 block text-[11px] text-zinc-500">{f.label}</span>
                    <input
                      className={`${cellCls} w-28`}
                      type="number"
                      value={(w[f.key] as number) || ""}
                      onChange={(e) => setW({ [f.key]: Number(e.target.value) || 0 })}
                    />
                  </label>
                ))}
                <p className="pb-1 text-xs font-bold tabular-nums text-zinc-700 dark:text-zinc-300">
                  Total: {workingTotal.toLocaleString("en-IN")}
                </p>
              </div>
              <input
                className={`${cellCls} mt-2 text-left`}
                value={w.assumptions || ""}
                placeholder="Assumptions (e.g. 2 meetings/month × 12 communities × ₹500 incl. tea & snacks)"
                onChange={(e) => setW({ assumptions: e.target.value || undefined })}
              />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
