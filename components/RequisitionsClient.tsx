"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, formatMoney, formatDate } from "@/lib/client";
import { Card, Empty, Badge, inputClass, labelClass, btnPrimary, btnGhost } from "@/components/ui";

interface Requisition {
  id: string;
  projectName: string | null;
  mobiliserName: string | null;
  kind: string;
  category: string;
  amount: number;
  currency: string;
  purpose: string;
  description: string | null;
  receipts: { key: string; url: string }[];
  status: string;
  reviewNote: string | null;
  paidAt: string | null;
  createdAt: string;
}

const CATEGORIES = ["travel", "materials", "refreshments", "communication", "other"];

export default function RequisitionsClient({ scope }: { scope: "director" | "cm" }) {
  const isDirector = scope === "director";
  const [rows, setRows] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  // CM create form
  const [showForm, setShowForm] = useState(false);
  const [kind, setKind] = useState<"advance" | "reimbursement">("reimbursement");
  const [category, setCategory] = useState("travel");
  const [amount, setAmount] = useState("");
  const [purpose, setPurpose] = useState("");
  const [description, setDescription] = useState("");
  const [receipts, setReceipts] = useState<{ key: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = isDirector && status ? `?status=${status}` : "";
      const { requisitions } = await apiFetch<{ requisitions: Requisition[] }>(
        `/api/requisitions${q}`
      );
      setRows(requisitions);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [isDirector, status]);

  useEffect(() => {
    load();
  }, [load]);

  async function uploadReceipt(file: File) {
    setUploading(true);
    setErr(null);
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
      await apiFetch("/api/requisitions", {
        method: "POST",
        body: JSON.stringify({
          kind,
          category,
          amount: Number(amount),
          purpose,
          description,
          receipts,
        }),
      });
      setAmount("");
      setPurpose("");
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

  async function review(id: string, action: "approve" | "reject") {
    const note = action === "reject" ? window.prompt("Reason (optional):") ?? "" : "";
    try {
      await apiFetch(`/api/requisitions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ action, note }),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function pay(id: string) {
    const paymentRef = window.prompt("Payment reference (optional):") ?? "";
    try {
      await apiFetch(`/api/requisitions/${id}/pay`, {
        method: "POST",
        body: JSON.stringify({ paymentRef }),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {!isDirector && (
        <button className={btnPrimary} onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ New request"}
        </button>
      )}

      {isDirector && (
        <select className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="paid">Paid</option>
          <option value="rejected">Rejected</option>
        </select>
      )}

      {showForm && !isDirector && (
        <Card>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className={labelClass}>Type of request</label>
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["advance", "Advance", "पैसे पहले चाहिए"],
                  ["reimbursement", "Reimbursement", "खर्च हो चुका है"],
                ] as const).map(([val, en, hi]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setKind(val)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      kind === val
                        ? "border-teal-600 bg-teal-50 text-teal-800 dark:border-teal-500 dark:bg-teal-950/40 dark:text-teal-300"
                        : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
                    }`}
                  >
                    <span className="block font-medium">{en}</span>
                    <span className="block text-[11px] opacity-80">{hi}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Category</label>
                <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c} className="capitalize">{c}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Amount (₹) *</label>
                <input className={inputClass} type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required />
              </div>
            </div>
            <div>
              <label className={labelClass}>Purpose *</label>
              <input className={inputClass} value={purpose} onChange={(e) => setPurpose(e.target.value)} required placeholder="e.g. Auto fare to Buxa Ghat" />
            </div>
            <div>
              <label className={labelClass}>Details</label>
              <textarea className={inputClass} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>
                {kind === "advance" ? "Bills (optional — attach after spending)" : "Receipts"}
              </label>
              <div className="flex flex-wrap gap-2">
                {receipts.map((r) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={r.key} src={r.url} alt="receipt" className="h-16 w-16 rounded-lg object-cover" />
                ))}
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-16 w-16 items-center justify-center rounded-lg border border-dashed border-zinc-300 text-2xl text-zinc-400 dark:border-zinc-700"
                >
                  {uploading ? "…" : "+"}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadReceipt(f);
                    e.target.value = "";
                  }}
                />
              </div>
            </div>
            {err && <p className="text-sm text-red-600">{err}</p>}
            <button type="submit" className={btnPrimary} disabled={saving || uploading}>
              {saving
                ? "Submitting…"
                : kind === "advance"
                ? "Request advance"
                : "Submit claim"}
            </button>
          </form>
        </Card>
      )}

      {err && !showForm && <p className="text-sm text-red-600">{err}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <Empty>No requisitions {isDirector ? "to review" : "yet"}.</Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {formatMoney(r.amount, r.currency)}{" "}
                    <span className="text-xs font-normal capitalize text-zinc-400">
                      · {r.category}
                    </span>
                  </p>
                  <span
                    className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${
                      r.kind === "advance"
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {r.kind === "advance" ? "Advance" : "Reimbursement"}
                  </span>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">{r.purpose}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {isDirector && r.mobiliserName ? `${r.mobiliserName} · ` : ""}
                    {formatDate(r.createdAt)}
                  </p>
                  {r.reviewNote && (
                    <p className="mt-0.5 text-xs text-zinc-500">Note: {r.reviewNote}</p>
                  )}
                </div>
                <Badge value={r.status} />
              </div>

              {r.receipts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.receipts.map((rc) => (
                    <a key={rc.key} href={rc.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={rc.url} alt="receipt" className="h-14 w-14 rounded-lg object-cover" />
                    </a>
                  ))}
                </div>
              )}

              {isDirector && (
                <div className="mt-3 flex gap-2">
                  {r.status === "pending" && (
                    <>
                      <button className={btnPrimary} onClick={() => review(r.id, "approve")}>
                        Approve
                      </button>
                      <button className={btnGhost} onClick={() => review(r.id, "reject")}>
                        Reject
                      </button>
                    </>
                  )}
                  {r.status === "approved" && (
                    <button className={btnPrimary} onClick={() => pay(r.id)}>
                      Mark paid
                    </button>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
