"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, formatDate } from "@/lib/client";
import { Icon } from "./icons";
import { notificationHref } from "@/lib/notification-links";

export interface NotificationItem {
  id: string;
  category: string;
  title: string;
  body: string;
  relatedType: string | null;
  relatedId: string | null;
  read: boolean;
  createdAt: string;
}

const POLL_MS = 60_000;

/**
 * Bell with an unread badge. Polls a cheap count every minute (and when the
 * tab regains focus) — the app runs on serverless hosting, so there is no
 * socket to push over.
 */
export default function NotificationBell({ area }: { area: string }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const refreshCount = useCallback(async () => {
    try {
      const r = await apiFetch<{ unread: number }>("/api/notifications?countOnly=1");
      setUnread(r.unread);
    } catch {
      /* offline / signed out: keep the last number */
    }
  }, []);

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, POLL_MS);
    const onFocus = () => document.visibilityState === "visible" && refreshCount();
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refreshCount]);

  // Close when clicking elsewhere.
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      try {
        const r = await apiFetch<{ notifications: NotificationItem[]; unread: number }>(
          "/api/notifications?pageSize=8"
        );
        setItems(r.notifications);
        setUnread(r.unread);
      } catch {
        setItems([]);
      }
    }
  };

  const openItem = async (n: NotificationItem) => {
    setOpen(false);
    if (!n.read) {
      setItems((prev) => prev?.map((x) => (x.id === n.id ? { ...x, read: true } : x)) ?? null);
      setUnread((u) => Math.max(u - 1, 0));
      apiFetch("/api/notifications/read", { method: "POST", body: JSON.stringify({ ids: [n.id] }) }).catch(() => {});
    }
    const href = notificationHref(area, n);
    if (href) router.push(href);
  };

  const markAll = async () => {
    await apiFetch("/api/notifications/read", { method: "POST", body: JSON.stringify({ all: true }) }).catch(() => {});
    setItems((prev) => prev?.map((x) => ({ ...x, read: true })) ?? null);
    setUnread(0);
  };

  return (
    <div className="relative print:hidden" ref={box}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `${unread} unread notifications` : "Notifications"}
        aria-expanded={open}
        className="relative rounded-lg p-2 text-zinc-500 transition hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        <Icon.bell />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-w-[1.1rem] rounded-full bg-red-600 px-1 text-center text-[10px] font-bold leading-[1.1rem] text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[92vw] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-900">
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Notifications</p>
            {unread > 0 && (
              <button onClick={markAll} className="text-xs font-medium text-teal-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-96 divide-y divide-zinc-100 overflow-y-auto dark:divide-zinc-900">
            {items === null ? (
              <li className="px-4 py-6 text-center text-sm text-zinc-400">Loading…</li>
            ) : items.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-zinc-400">You&apos;re all caught up.</li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    onClick={() => openItem(n)}
                    className={`block w-full px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900 ${
                      n.read ? "" : "bg-teal-50/60 dark:bg-teal-950/20"
                    }`}
                  >
                    <p className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-100">
                      {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-teal-600" />}
                      <span className="truncate">{n.title}</span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">{n.body}</p>
                    <p className="mt-1 text-[11px] text-zinc-400">{formatDate(n.createdAt)}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
          <Link
            href={`${area}/notifications`}
            onClick={() => setOpen(false)}
            className="block border-t border-zinc-100 px-4 py-2.5 text-center text-sm font-medium text-teal-600 hover:bg-zinc-50 dark:border-zinc-900 dark:hover:bg-zinc-900"
          >
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
