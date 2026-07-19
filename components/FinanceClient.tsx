"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, formatMoney, formatDate } from "@/lib/client";
import { Card, Empty, Badge, inputClass, labelClass, btnPrimary, btnGhost } from "@/components/ui";
import RequisitionsClient from "@/components/RequisitionsClient";
import ProjectsClient from "@/components/ProjectsClient";

interface Project {
  id: string;
  name: string;
  currency: string;
  totalFunds: number;
  spentFunds: number;
  balance: number;
}
interface Expense {
  id: string;
  projectName: string | null;
  category: string;
  amount: number;
  currency: string;
  description: string | null;
  paidTo: string | null;
  date: string;
  receipts: { key: string; url: string }[];
  createdByName: string | null;
}
interface LedgerEntry {
  id: string;
  type: string;
  amount: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  mobiliserName: string | null;
  type: string;
  amount: number;
  currency: string;
  period: string | null;
  note: string | null;
  status: string;
  createdAt: string;
}

const TABS = ["overview", "funds", "expenses", "payroll", "reimbursements", "statement"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  overview: "Overview",
  funds: "Funds",
  expenses: "Expenses",
  payroll: "Payroll",
  reimbursements: "Requests",
  statement: "Statement",
};
const CATEGORIES = ["travel", "materials", "camp", "refreshments", "communication", "salary", "printing", "other"];

export default function FinanceClient() {
  const [tab, setTab] = useState<Tab>("overview");
  const [projects, setProjects] = useState<Project[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ projects: Project[] }>("/api/projects")
      .then(({ projects }) => setProjects(projects))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t
                ? "bg-teal-700 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            }`}
          >
            {TAB_LABEL[t]}
          </button>
        ))}
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {tab === "overview" && <Overview projects={projects} />}
      {tab === "funds" && <ProjectsClient />}
      {tab === "expenses" && <Expenses projects={projects} />}
      {tab === "payroll" && <Payroll />}
      {tab === "reimbursements" && <RequisitionsClient scope="director" />}
      {tab === "statement" && <Statement projects={projects} />}
    </div>
  );
}

function Overview({ projects }: { projects: Project[] }) {
  if (projects.length === 0)
    return <Empty>No projects yet. Create one under Projects.</Empty>;
  return (
    <div className="space-y-3">
      {projects.map((p) => (
        <Card key={p.id}>
          <div className="flex items-center justify-between">
            <p className="font-semibold text-zinc-900 dark:text-zinc-50">{p.name}</p>
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
        </Card>
      ))}
    </div>
  );
}

function Expenses({ projects }: { projects: Project[] }) {
  const [rows, setRows] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [projectId, setProjectId] = useState("");
  const [category, setCategory] = useState("travel");
  const [amount, setAmount] = useState("");
  const [paidTo, setPaidTo] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [receipts, setReceipts] = useState<{ key: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { expenses } = await apiFetch<{ expenses: Expense[] }>("/api/expenses");
      setRows(expenses);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!projectId && projects[0]) setProjectId(projects[0].id);
  }, [projects, projectId]);

  async function upload(file: File) {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("prefix", "receipts");
    try {
      const res = await apiFetch<{ key: string; url: string }>("/api/uploads", {
        method: "POST",
        body: fd,
      });
      setReceipts((r) => [...r, { key: res.key, url: res.url }]);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      await apiFetch("/api/expenses", {
        method: "POST",
        body: JSON.stringify({
          projectId,
          category,
          amount: Number(amount),
          paidTo,
          date,
          description,
          receipts,
        }),
      });
      setAmount("");
      setPaidTo("");
      setDescription("");
      setReceipts([]);
      setShowForm(false);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <button className={btnPrimary} onClick={() => setShowForm((s) => !s)}>
        {showForm ? "Cancel" : "+ Add expense"}
      </button>

      {showForm && (
        <Card>
          <form onSubmit={create} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Project</label>
                <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Category</label>
                <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Amount (₹) *</label>
                <input className={inputClass} type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
              <div>
                <label className={labelClass}>Date</label>
                <input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Paid to</label>
              <input className={inputClass} value={paidTo} onChange={(e) => setPaidTo(e.target.value)} placeholder="Vendor / person" />
            </div>
            <div>
              <label className={labelClass}>Description</label>
              <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Bill / receipt</label>
              <div className="flex flex-wrap gap-2">
                {receipts.map((r) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={r.key} src={r.url} alt="receipt" className="h-16 w-16 rounded-lg object-cover" />
                ))}
                <button type="button" onClick={() => fileRef.current?.click()} className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-2xl text-zinc-400 dark:border-zinc-700">
                  {uploading ? "…" : "+"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
              </div>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button type="submit" className={btnPrimary} disabled={saving || uploading || !projectId}>
              {saving ? "Saving…" : "Record expense"}
            </button>
          </form>
        </Card>
      )}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <Empty>No expenses recorded yet.</Empty>
      ) : (
        <div className="space-y-2">
          {rows.map((x) => (
            <Card key={x.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatMoney(x.amount, x.currency)}{" "}
                    <span className="text-xs font-normal capitalize text-zinc-400">· {x.category}</span>
                  </p>
                  {x.description && <p className="text-sm text-zinc-600 dark:text-zinc-300">{x.description}</p>}
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {x.paidTo ? `${x.paidTo} · ` : ""}
                    {x.projectName ? `${x.projectName} · ` : ""}
                    {formatDate(x.date)}
                  </p>
                </div>
                <button
                  className="rounded px-1.5 py-0.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={async () => {
                    if (!window.confirm("Delete this expense permanently?")) return;
                    try {
                      await apiFetch(`/api/expenses/${x.id}`, { method: "DELETE" });
                      await load();
                    } catch (e) {
                      setErr((e as Error).message);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
              {x.receipts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {x.receipts.map((rc) => (
                    <a key={rc.key} href={rc.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={rc.url} alt="receipt" className="h-14 w-14 rounded-lg object-cover" />
                    </a>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

const PAY_TYPES = ["salary", "benefit", "bonus", "other"];

function Payroll() {
  const [cms, setCms] = useState<{ id: string; name: string }[]>([]);
  const [rows, setRows] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [mobiliserId, setMobiliserId] = useState("");
  const [type, setType] = useState("salary");
  const [amount, setAmount] = useState("");
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7));
  const [note, setNote] = useState("");
  const [payNow, setPayNow] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, p] = await Promise.all([
        apiFetch<{ users: { id: string; name: string }[] }>("/api/users"),
        apiFetch<{ payments: Payment[] }>("/api/payments"),
      ]);
      setCms(u.users);
      setRows(p.payments);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    try {
      const res = await apiFetch<{ warning?: string }>("/api/payments", {
        method: "POST",
        body: JSON.stringify({
          mobiliserId,
          type,
          amount: Number(amount),
          period: type === "salary" ? period : undefined,
          note,
          payNow,
        }),
      });
      if (res.warning) setErr(res.warning);
      setAmount("");
      setNote("");
      setShowForm(false);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function pay(id: string) {
    try {
      await apiFetch(`/api/payments/${id}/pay`, { method: "POST" });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <button className={btnPrimary} onClick={() => setShowForm((s) => !s)}>
        {showForm ? "Cancel" : "+ Pay salary / benefit"}
      </button>

      {showForm && (
        <Card>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className={labelClass}>Mobiliser *</label>
              <select className={inputClass} value={mobiliserId} onChange={(e) => setMobiliserId(e.target.value)} required>
                <option value="">— select —</option>
                {cms.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Type</label>
                <select className={inputClass} value={type} onChange={(e) => setType(e.target.value)}>
                  {PAY_TYPES.map((t) => (
                    <option key={t} value={t} className="capitalize">{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Amount (₹) *</label>
                <input className={inputClass} type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
            </div>
            {type === "salary" && (
              <div>
                <label className={labelClass}>Salary month</label>
                <input className={inputClass} type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />
              </div>
            )}
            <div>
              <label className={labelClass}>Note</label>
              <input className={inputClass} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. July salary, travel benefit" />
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
              <input type="checkbox" checked={payNow} onChange={(e) => setPayNow(e.target.checked)} />
              Pay now (debit project funds immediately)
            </label>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button type="submit" className={btnPrimary} disabled={saving || !mobiliserId}>
              {saving ? "Saving…" : payNow ? "Pay" : "Record"}
            </button>
          </form>
        </Card>
      )}

      {err && !showForm && <p className="text-sm text-red-600">{err}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <Empty>No salary or benefit payments yet.</Empty>
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatMoney(p.amount, p.currency)}{" "}
                    <span className="text-xs font-normal capitalize text-zinc-400">
                      · {p.type}
                      {p.period ? ` · ${p.period}` : ""}
                    </span>
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    {p.mobiliserName}
                    {p.note ? ` — ${p.note}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-400">{formatDate(p.createdAt)}</p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge value={p.status} />
                  {p.status === "pending" && (
                    <button className={btnGhost} onClick={() => pay(p.id)}>
                      Pay now
                    </button>
                  )}
                  {p.status === "pending" && (
                    <button
                      className="rounded px-1.5 py-0.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                      onClick={async () => {
                        if (!window.confirm("Delete this pending payment?")) return;
                        try {
                          await apiFetch(`/api/payments/${p.id}`, { method: "DELETE" });
                          await load();
                        } catch (e) {
                          setErr((e as Error).message);
                        }
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Statement({ projects }: { projects: Project[] }) {
  const [projectId, setProjectId] = useState("");
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const q = projectId ? `?projectId=${projectId}` : "";
    try {
      const { entries } = await apiFetch<{ entries: LedgerEntry[] }>(
        `/api/finance/statement${q}`
      );
      setEntries(entries);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
          <option value="">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <a href={`/api/finance/export${projectId ? `?projectId=${projectId}` : ""}`} className={btnGhost}>
          ⬇ Excel
        </a>
      </div>

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : entries.length === 0 ? (
        <Empty>No transactions yet.</Empty>
      ) : (
        <div className="space-y-1.5">
          {entries.map((e) => {
            const credit = e.type === "allocation";
            return (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-700 dark:text-zinc-200">
                    {e.note || e.type}
                  </p>
                  <p className="text-xs text-zinc-400">{formatDate(e.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${credit ? "text-teal-600 dark:text-teal-400" : "text-red-500"}`}>
                    {credit ? "+" : "−"}
                    {formatMoney(e.amount)}
                  </p>
                  <p className="text-xs text-zinc-400">bal {formatMoney(e.balanceAfter)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
