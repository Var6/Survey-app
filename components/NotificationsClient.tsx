"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import Pagination from "./Pagination";
import type { NotificationItem } from "./NotificationBell";
import { NOTIFICATION_LABEL, notificationHref } from "@/lib/notification-links";
import { inputCls } from "./case-ui";

interface Resp {
  notifications: NotificationItem[];
  total: number;
  unread: number;
  page: number;
  pageSize: number;
  pages: number;
}

/** Full notification history: filter by category / unread, mark read, open the record. */
export default function NotificationsClient({
  area,
  categories,
}: {
  area: string;
  /** Categories this role can receive — drives the filter list. */
  categories: string[];
}) {
  const router = useRouter();
  const [data, setData] = useState<Resp | null>(null);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({ page: String(page), pageSize: "25" });
    if (category) q.set("category", category);
    if (unreadOnly) q.set("unread", "1");
    try {
      setData(await apiFetch<Resp>(`/api/notifications?${q}`));
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, category, unreadOnly]);
  useEffect(() => {
    load();
  }, [load]);

  const markAll = async () => {
    await apiFetch("/api/notifications/read", { method: "POST", body: JSON.stringify({ all: true }) });
    load();
  };
  const open = async (n: NotificationItem) => {
    if (!n.read) {
      apiFetch("/api/notifications/read", { method: "POST", body: JSON.stringify({ ids: [n.id] }) }).catch(() => {});
    }
    const href = notificationHref(area, n);
    if (href) router.push(href);
    else load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-zinc-500">Type</span>
          <select
            className={inputCls}
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All notifications</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {NOTIFICATION_LABEL[c] ?? c}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(e) => {
              setUnreadOnly(e.target.checked);
              setPage(1);
            }}
          />
          Unread only
        </label>
        <button
          onClick={markAll}
          disabled={!data?.unread}
          className="ml-auto rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Mark all as read{data?.unread ? ` (${data.unread})` : ""}
        </button>
      </div>

      {err && <p className="text-sm text-red-600">{err}</p>}

      {loading && !data ? (
        <p className="text-sm text-zinc-400">Loading…</p>
      ) : data && data.notifications.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 py-12 text-center text-sm text-zinc-400 dark:border-zinc-700">
          {unreadOnly || category ? "No notifications match this filter." : "No notifications yet."}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
          {data?.notifications.map((n) => (
            <li key={n.id}>
              <button
                onClick={() => open(n)}
                className={`flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                  n.read ? "bg-white dark:bg-zinc-950" : "bg-teal-50/60 dark:bg-teal-950/20"
                }`}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-teal-600"}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{n.title}</span>
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {NOTIFICATION_LABEL[n.category] ?? n.category}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-sm text-zinc-600 dark:text-zinc-300">{n.body}</span>
                  <span className="mt-1 block text-[11px] text-zinc-400">{formatDate(n.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {data && (
        <Pagination
          page={data.page}
          pages={data.pages}
          total={data.total}
          pageSize={data.pageSize}
          busy={loading}
          onPage={setPage}
        />
      )}
    </div>
  );
}
