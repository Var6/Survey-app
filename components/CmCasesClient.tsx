"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { MODULES } from "@/lib/cases/modules";
import Pagination from "./Pagination";
import { CaseItem, PriorityPill, WorkflowPill, inputCls } from "./case-ui";

interface ListResp {
  cases: CaseItem[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
}

/** What the CM sees first: the cases waiting for their follow-up. */
const TABS = [
  {
    key: "todo",
    hi: "करने के लिए",
    en: "To do",
    q: "status=open&workflow=open,follow_up_in_progress,revision_required",
  },
  { key: "review", hi: "जाँच में", en: "In review", q: "status=open&closure=pending" },
  { key: "closed", hi: "बंद", en: "Closed", q: "status=closed" },
] as const;

export default function CmCasesClient() {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("todo");
  const [page, setPage] = useState(1);
  const [qText, setQText] = useState("");
  const [q, setQ] = useState("");
  const [data, setData] = useState<ListResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setQ(qText.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [qText]);

  const load = useCallback(async () => {
    setLoading(true);
    const tabQ = TABS.find((t) => t.key === tab)!.q;
    const params = new URLSearchParams(tabQ);
    params.set("page", String(page));
    params.set("pageSize", "30");
    if (q) params.set("q", q);
    try {
      setData(await apiFetch<ListResp>(`/api/cases?${params}`));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [tab, page, q]);
  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => {
              setTab(t.key);
              setPage(1);
            }}
            className={`flex-1 rounded-md px-2 py-2 text-sm font-medium transition ${
              tab === t.key
                ? "bg-teal-700 text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
            }`}
          >
            {t.hi} <span className="text-xs opacity-70">· {t.en}</span>
          </button>
        ))}
      </div>
      <input
        value={qText}
        onChange={(e) => setQText(e.target.value)}
        placeholder="खोजें · Search case ID, name, household"
        className={inputCls}
      />
      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading && !data ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : data && data.cases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
          {tab === "todo" ? "कोई केस बाकी नहीं 🎉 · No cases waiting for you." : "कोई केस नहीं · Nothing here."}
        </div>
      ) : (
        <ul className={`space-y-2 ${loading ? "opacity-60" : ""}`}>
          {data?.cases.map((c) => {
            const overdue = !c.closed && c.dueDate && c.dueDate < new Date().toISOString().slice(0, 10);
            return (
              <li key={c.id}>
                <Link
                  href={`/cm/cases/${c.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-teal-400 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-mono text-xs text-zinc-400">
                        {c.caseId} · {MODULES[c.module].short}
                      </p>
                      <p className="mt-0.5 font-semibold text-zinc-900 dark:text-zinc-50">
                        {c.subjectName || "—"}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {c.subcategoryLabel} · {c.householdId}
                      </p>
                    </div>
                    <PriorityPill priority={c.priority} />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <WorkflowPill status={c.workflowStatus} />
                    {c.followupCount > 0 && (
                      <span className="text-zinc-400">{c.followupCount} फॉलो-अप</span>
                    )}
                    {c.dueDate && (
                      <span className={overdue ? "font-semibold text-red-600" : "text-zinc-400"}>
                        {overdue ? "देर · Overdue " : "तारीख़ · "}
                        {formatDate(c.dueDate)}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {data && (
        <Pagination
          page={data.page}
          pages={data.pages}
          total={data.total}
          pageSize={data.pageSize}
          busy={loading}
          onPage={(p) => {
            setPage(p);
            window.scrollTo({ top: 0, behavior: "smooth" });
          }}
        />
      )}
    </div>
  );
}
