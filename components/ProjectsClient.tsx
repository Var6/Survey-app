"use client";

import { useEffect, useState } from "react";
import { apiFetch, formatMoney } from "@/lib/client";
import { Card, Empty, inputClass, labelClass, btnPrimary, btnGhost } from "@/components/ui";

interface Project {
  id: string;
  name: string;
  funder: string | null;
  currency: string;
  totalFunds: number;
  spentFunds: number;
  balance: number;
  active: boolean;
}

export default function ProjectsClient() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [funder, setFunder] = useState("Azim Premji Foundation");
  const [currency, setCurrency] = useState("INR");
  const [totalFunds, setTotalFunds] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const [fundsFor, setFundsFor] = useState<string | null>(null);
  const [fundsAmount, setFundsAmount] = useState("");
  const [fundsMode, setFundsMode] = useState<"add" | "reduce">("add");
  const [fundsNote, setFundsNote] = useState("");

  async function load() {
    try {
      const { projects } = await apiFetch<{ projects: Project[] }>("/api/projects");
      setProjects(projects);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await apiFetch("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name,
          funder,
          currency,
          totalFunds: Number(totalFunds) || 0,
          description,
        }),
      });
      setName("");
      setTotalFunds("");
      setDescription("");
      setShowForm(false);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function openFunds(id: string, mode: "add" | "reduce") {
    setFundsFor(id);
    setFundsMode(mode);
    setFundsAmount("");
    setFundsNote("");
    setErr(null);
  }

  async function applyFunds(id: string) {
    const amount = Number(fundsAmount);
    if (!amount || amount <= 0) return;
    const payload =
      fundsMode === "add"
        ? { addFunds: amount, fundsNote }
        : { reduceFunds: amount, fundsNote };
    try {
      await apiFetch(`/api/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setFundsFor(null);
      setFundsAmount("");
      setFundsNote("");
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <button className={btnPrimary} onClick={() => setShowForm((s) => !s)}>
        {showForm ? "Cancel" : "+ New project"}
      </button>

      {showForm && (
        <Card>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className={labelClass}>Project name *</label>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Funder</label>
                <input className={inputClass} value={funder} onChange={(e) => setFunder(e.target.value)} />
              </div>
              <div>
                <label className={labelClass}>Currency</label>
                <input className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Total funds</label>
              <input
                className={inputClass}
                type="number"
                min="0"
                value={totalFunds}
                onChange={(e) => setTotalFunds(e.target.value)}
                placeholder="e.g. 500000"
              />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? "Creating…" : "Create project"}
            </button>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : projects.length === 0 ? (
        <Empty>No projects yet. Create your first funding project.</Empty>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</p>
                  {p.funder && <p className="text-sm text-zinc-500">{p.funder}</p>}
                </div>
                <span className="text-lg font-bold text-teal-700 dark:text-teal-400">
                  {formatMoney(p.balance, p.currency)}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-lg bg-zinc-100 py-2 dark:bg-zinc-900">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatMoney(p.totalFunds, p.currency)}
                  </p>
                  <p className="text-zinc-500">Total</p>
                </div>
                <div className="rounded-lg bg-zinc-100 py-2 dark:bg-zinc-900">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatMoney(p.spentFunds, p.currency)}
                  </p>
                  <p className="text-zinc-500">Spent</p>
                </div>
                <div className="rounded-lg bg-zinc-100 py-2 dark:bg-zinc-900">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">
                    {formatMoney(p.balance, p.currency)}
                  </p>
                  <p className="text-zinc-500">Balance</p>
                </div>
              </div>
              {fundsFor === p.id ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-medium text-zinc-500">
                    {fundsMode === "add" ? "Add funds to" : "Reduce funds from"} this project
                  </p>
                  <div className="flex gap-2">
                    <input
                      className={inputClass}
                      type="number"
                      min="1"
                      value={fundsAmount}
                      onChange={(e) => setFundsAmount(e.target.value)}
                      placeholder="Amount"
                    />
                    <button className={btnPrimary} onClick={() => applyFunds(p.id)}>
                      {fundsMode === "add" ? "Add" : "Reduce"}
                    </button>
                    <button className={btnGhost} onClick={() => setFundsFor(null)}>
                      ✕
                    </button>
                  </div>
                  <input
                    className={inputClass}
                    value={fundsNote}
                    onChange={(e) => setFundsNote(e.target.value)}
                    placeholder="Note (optional) — e.g. tranche 2, correction"
                  />
                </div>
              ) : (
                <div className="mt-3 flex gap-2">
                  <button className={btnGhost} onClick={() => openFunds(p.id, "add")}>
                    + Add funds
                  </button>
                  <button className={btnGhost} onClick={() => openFunds(p.id, "reduce")}>
                    − Reduce funds
                  </button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
