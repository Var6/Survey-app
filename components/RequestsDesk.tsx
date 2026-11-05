"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { apiFetch, formatMoney, formatDate } from "@/lib/client";
import { Card, Empty, Badge, inputClass, labelClass, btnPrimary, btnGhost } from "@/components/ui";
import Pagination from "@/components/Pagination";

/**
 * The finance desk for requisitions (advances) and reimbursements: what is
 * waiting for approval, what is approved and waiting to be paid, what was paid
 * or rejected. The counts above the list are for the whole filtered set, not
 * just the page on screen, and are computed with the same filter as the list.
 */

interface Request {
  id: string;
  projectName: string | null;
  projectBalance: number | null;
  mobiliserName: string | null;
  kind: "advance" | "reimbursement";
  category: string;
  amount: number;
  currency: string;
  purpose: string;
  description: string | null;
  receipts: { key: string; url: string }[];
  status: "pending" | "approved" | "paid" | "rejected";
  reviewNote: string | null;
  paidAt: string | null;
  paymentRef: string | null;
  createdAt: string;
}
type Bucket = { count: number; amount: number };
interface Facets {
  status: Record<Request["status"], Bucket>;
  kind: Record<Request["kind"], Bucket>;
  matching: Bucket;
}
interface Resp {
  requisitions: Request[];
  total: number;
  page: number;
  pages: number;
  limit: number;
  facets: Facets;
}

const PAGE_SIZE = 100;
const STATUS: { key: "" | Request["status"]; label: string }[] = [
  { key: "", label: "All" },
  { key: "pending", label: "Waiting for approval" },
  { key: "approved", label: "Approved, to be paid" },
  { key: "paid", label: "Paid" },
  { key: "rejected", label: "Rejected" },
];
const KINDS: { key: "" | Request["kind"]; label: string }[] = [
  { key: "", label: "Requisitions & reimbursements" },
  { key: "advance", label: "Requisitions (advance)" },
  { key: "reimbursement", label: "Reimbursements" },
];

const money = (n: number) => formatMoney(n, "INR");

export default function RequestsDesk({ keepParams }: { keepParams?: Record<string, string> } = {}) {
  const router = useRouter();
  const keepKey = JSON.stringify(keepParams || {});
  const pathname = usePathname();
  const urlParams = useSearchParams();
  const pick = (k: string) => urlParams.get(k) || "";

  const [page, setPage] = useState(1);
  const [kind, setKindRaw] = useState(() => pick("kind"));
  const [status, setStatusRaw] = useState(() => pick("status"));
  const [q, setQRaw] = useState(() => pick("q"));
  const [from, setFromRaw] = useState(() => pick("from"));
  const [to, setToRaw] = useState(() => pick("to"));
  // Changing any filter goes back to the first page.
  const setKind = (v: string) => { setKindRaw(v); setPage(1); };
  const setStatus = (v: string) => { setStatusRaw(v); setPage(1); };
  const setQ = (v: string) => { setQRaw(v); setPage(1); };
  const setFrom = (v: string) => { setFromRaw(v); setPage(1); };
  const setTo = (v: string) => { setToRaw(v); setPage(1); };
  const [openId] = useState(() => pick("open"));

  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{ type: "reject" | "pay"; req: Request } | null>(null);
  const [text, setText] = useState("");
  const [dialogErr, setDialogErr] = useState<string | null>(null);
  const highlighted = useRef(false);

  const query = useCallback(
    (extra?: Record<string, string>) => {
      const p = new URLSearchParams();
      if (kind) p.set("kind", kind);
      if (status) p.set("status", status);
      if (q.trim()) p.set("q", q.trim());
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      for (const [k, v] of Object.entries(extra || {})) p.set(k, v);
      return p;
    },
    [kind, status, q, from, to]
  );

  // Keep the address in step with the filters, so a refresh or a shared link shows the same list.
  useEffect(() => {
    const p = query();
    if (openId) p.set("open", openId);
    for (const [k, v] of Object.entries(JSON.parse(keepKey) as Record<string, string>)) p.set(k, v);
    const qs = p.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [query, router, pathname, openId, keepKey]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiFetch<Resp>(`/api/requisitions?${query({ page: String(page), limit: String(PAGE_SIZE) })}`);
      setData(r);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [query, page]);

  // Typing in the search box waits a moment before asking the server.
  useEffect(() => {
    const t = setTimeout(load, q ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, q]);

  // A notification opens one request: scroll to it once it is on screen.
  useEffect(() => {
    if (!openId || highlighted.current || !data) return;
    const el = document.getElementById(`req-${openId}`);
    if (el) {
      highlighted.current = true;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [openId, data]);

  async function act(fn: () => Promise<unknown>, done: string) {
    setErr(null);
    try {
      await fn();
      setNotice(done);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const approve = (r: Request) => {
    setBusyId(r.id);
    return act(
      () => apiFetch(`/api/requisitions/${r.id}`, { method: "PATCH", body: JSON.stringify({ action: "approve" }) }),
      "Approved. It is now waiting to be paid."
    ).finally(() => setBusyId(null));
  };

  async function submitDialog() {
    if (!dialog) return;
    const { type, req } = dialog;
    if (type === "reject" && !text.trim()) {
      setDialogErr("Write the reason so the requester knows what to fix.");
      return;
    }
    setBusyId(req.id);
    setDialogErr(null);
    try {
      if (type === "reject") {
        await apiFetch(`/api/requisitions/${req.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action: "reject", note: text.trim() }),
        });
        setNotice("Rejected. The requester has been told why.");
      } else {
        await apiFetch(`/api/requisitions/${req.id}/pay`, {
          method: "POST",
          body: JSON.stringify({ paymentRef: text.trim() }),
        });
        setNotice("Marked as paid and entered in the project ledger.");
      }
      setDialog(null);
      setText("");
      await load();
    } catch (e) {
      setDialogErr((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  const remove = (r: Request) => {
    if (!window.confirm("Delete this request permanently?")) return;
    setBusyId(r.id);
    return act(() => apiFetch(`/api/requisitions/${r.id}`, { method: "DELETE" }), "Deleted.").finally(() =>
      setBusyId(null)
    );
  };

  const exportHref = `/api/requisitions?${query({ format: "csv" })}`;
  const f = data?.facets;
  const filtered = !!(kind || status || q || from || to);

  return (
    <div className="space-y-4">
      {/* Kind tabs */}
      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map((k) => {
          const n = k.key === "" ? undefined : f?.kind[k.key]?.count;
          return (
            <button
              key={k.key || "all"}
              onClick={() => setKind(k.key)}
              className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                kind === k.key
                  ? "border-teal-700 bg-teal-700 text-white"
                  : "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              }`}
            >
              {k.label}
              {n !== undefined && <span className="ml-1.5 tabular-nums opacity-80">{n}</span>}
            </button>
          );
        })}
        <a href={exportHref} className={`${btnGhost} ml-auto`} download>
          Download Excel (CSV)
        </a>
      </div>

      {/* Status chips with counts and rupees */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {STATUS.map((s) => {
          const b = s.key === "" ? undefined : f?.status[s.key];
          const count = s.key === "" ? (f ? Object.values(f.status).reduce((n, x) => n + x.count, 0) : 0) : b?.count ?? 0;
          const amount = s.key === "" ? (f ? Object.values(f.status).reduce((n, x) => n + x.amount, 0) : 0) : b?.amount ?? 0;
          const active = status === s.key;
          return (
            <button
              key={s.key || "all"}
              onClick={() => setStatus(s.key)}
              className={`rounded-xl border p-3 text-left transition ${
                active
                  ? "border-teal-600 bg-teal-50 ring-2 ring-teal-600/20 dark:bg-teal-950/30"
                  : "border-zinc-200 bg-white hover:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950"
              }`}
            >
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{s.label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-50">{count}</p>
              <p className="text-xs tabular-nums text-zinc-400">{money(amount)}</p>
            </button>
          );
        })}
      </div>

      {/* Search + dates */}
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label className={labelClass}>Search</label>
          <input
            className={inputClass}
            placeholder="Name of the person, purpose, category, payment reference"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Requested from</label>
          <input type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label className={labelClass}>Requested until</label>
          <input type="date" className={inputClass} value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>
      {filtered && (
        <button
          className="text-sm font-medium text-teal-700 underline dark:text-teal-400"
          onClick={() => {
            setKind("");
            setStatus("");
            setQ("");
            setFrom("");
            setTo("");
          }}
        >
          Clear all filters
        </button>
      )}

      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" role="status">
          {notice}
        </p>
      )}
      {err && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300" role="alert">
          {err}
        </p>
      )}

      {data && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {data.facets.matching.count.toLocaleString("en-IN")} request{data.facets.matching.count === 1 ? "" : "s"} ·{" "}
          <span className="font-semibold tabular-nums text-zinc-700 dark:text-zinc-200">
            {money(data.facets.matching.amount)}
          </span>{" "}
          in total
        </p>
      )}

      {loading && !data ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : data && data.requisitions.length === 0 ? (
        <Empty>{filtered ? "No requests match these filters." : "No requests yet."}</Empty>
      ) : (
        <div className="space-y-3">
          {data?.requisitions.map((r) => {
            const short = r.status === "approved" && r.projectBalance !== null && r.amount > r.projectBalance;
            return (
              <div key={r.id} id={`req-${r.id}`} className={r.id === openId ? "rounded-xl ring-2 ring-teal-500" : ""}>
                <Card>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {formatMoney(r.amount, r.currency)}{" "}
                        <span className="text-xs font-normal capitalize text-zinc-400">· {r.category}</span>
                      </p>
                      <span
                        className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          r.kind === "advance"
                            ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300"
                            : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {r.kind === "advance" ? "Requisition (advance)" : "Reimbursement"}
                      </span>
                      <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{r.purpose}</p>
                      {r.description && <p className="text-xs text-zinc-500">{r.description}</p>}
                      <p className="mt-0.5 text-xs text-zinc-400">
                        {r.mobiliserName ? `${r.mobiliserName} · ` : ""}
                        {formatDate(r.createdAt)}
                        {r.projectName ? ` · ${r.projectName}` : ""}
                        {r.status !== "paid" && r.status !== "rejected" && r.projectBalance !== null
                          ? ` · balance ${money(r.projectBalance)}`
                          : ""}
                      </p>
                      {r.reviewNote && <p className="mt-0.5 text-xs text-zinc-500">Note: {r.reviewNote}</p>}
                      {r.status === "paid" && (
                        <p className="mt-0.5 text-xs text-zinc-500">
                          Paid {formatDate(r.paidAt)}
                          {r.paymentRef ? ` · ref ${r.paymentRef}` : ""}
                        </p>
                      )}
                      {short && (
                        <p className="mt-1 text-xs font-medium text-red-600">
                          More than the project has left. Add funds before paying.
                        </p>
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

                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.status === "pending" && (
                      <>
                        <button className={btnPrimary} disabled={busyId === r.id} onClick={() => approve(r)}>
                          Approve
                        </button>
                        <button
                          className={btnGhost}
                          disabled={busyId === r.id}
                          onClick={() => {
                            setText("");
                            setDialogErr(null);
                            setDialog({ type: "reject", req: r });
                          }}
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {r.status === "approved" && (
                      <button
                        className={btnPrimary}
                        disabled={busyId === r.id || short}
                        onClick={() => {
                          setText("");
                          setDialogErr(null);
                          setDialog({ type: "pay", req: r });
                        }}
                      >
                        Mark as paid
                      </button>
                    )}
                    {r.status !== "paid" && (
                      <button
                        className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:hover:bg-red-950/30"
                        disabled={busyId === r.id}
                        onClick={() => remove(r)}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {data && (
        <Pagination page={data.page} pages={data.pages} total={data.total} pageSize={PAGE_SIZE} onPage={setPage} busy={loading} />
      )}

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl dark:bg-zinc-950">
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              {dialog.type === "reject" ? "Reject this request" : "Mark as paid"}
            </h3>
            <p className="mt-1 text-sm text-zinc-500">
              {formatMoney(dialog.req.amount, dialog.req.currency)} · {dialog.req.mobiliserName} · {dialog.req.purpose}
            </p>
            {dialog.type === "pay" && dialog.req.projectBalance !== null && (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
                Project balance now {money(dialog.req.projectBalance)}; after this payment{" "}
                <span className="font-semibold">{money(dialog.req.projectBalance - dialog.req.amount)}</span>.
              </p>
            )}
            <label className={`${labelClass} mt-3`} htmlFor="dlg-text">
              {dialog.type === "reject" ? "Reason (the requester will see this)" : "Payment reference (optional)"}
            </label>
            {dialog.type === "reject" ? (
              <textarea id="dlg-text" className={inputClass} rows={3} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
            ) : (
              <input
                id="dlg-text"
                className={inputClass}
                placeholder="UPI / cheque / transfer number"
                value={text}
                onChange={(e) => setText(e.target.value)}
                autoFocus
              />
            )}
            {dialogErr && <p className="mt-2 text-sm text-red-600">{dialogErr}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button className={btnGhost} onClick={() => setDialog(null)} disabled={busyId === dialog.req.id}>
                Cancel
              </button>
              <button className={btnPrimary} onClick={submitDialog} disabled={busyId === dialog.req.id}>
                {busyId === dialog.req.id ? "Saving…" : dialog.type === "reject" ? "Reject" : "Confirm payment"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
