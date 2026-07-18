"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { OUTBOX_EVENT, outboxItems, removeOutbox } from "@/lib/outbox";

/**
 * Background uploader for offline-queued surveys. Mounted once in the CM
 * layout. Retries the outbox on reconnect, on a 30s timer, and when the queue
 * changes. Shows a small status pill when offline or when items are pending.
 */
export default function OfflineSync() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [online, setOnline] = useState(true);
  const [flushing, setFlushing] = useState(false);
  const busy = useRef(false);

  const refresh = useCallback(() => setCount(outboxItems().length), []);

  const flush = useCallback(async () => {
    if (busy.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;
    const items = outboxItems();
    if (items.length === 0) return;

    busy.current = true;
    setFlushing(true);
    let uploaded = 0;
    for (const item of items) {
      try {
        const res = await fetch("/api/surveys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(item.payload),
        });
        if (res.ok) {
          removeOutbox(item.tempId);
          uploaded++;
        }
        // Non-OK (auth/validation/5xx): keep it and retry later — never drop
        // a survey, so field data is not lost.
      } catch {
        // Network error mid-flush → stop; we'll retry on the next tick.
        break;
      }
    }
    busy.current = false;
    setFlushing(false);
    refresh();
    if (uploaded > 0) router.refresh();
  }, [refresh, router]);

  useEffect(() => {
    refresh();
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);

    const onOnline = () => {
      setOnline(true);
      flush();
    };
    const onOffline = () => setOnline(false);
    const onChange = () => {
      refresh();
      flush();
    };

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    window.addEventListener(OUTBOX_EVENT, onChange);
    const timer = setInterval(flush, 30000);
    flush(); // attempt once on mount

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.removeEventListener(OUTBOX_EVENT, onChange);
      clearInterval(timer);
    };
  }, [flush, refresh]);

  if (online && count === 0) return null;

  return (
    <div
      className={`fixed bottom-20 right-3 z-40 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium shadow-md ${
        online
          ? "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800/50 dark:bg-amber-950/60 dark:text-amber-300"
          : "border-zinc-300 bg-zinc-800 text-zinc-100 dark:border-zinc-700"
      }`}
    >
      <span
        className={`h-2 w-2 rounded-full ${online ? "bg-amber-500" : "bg-red-500"}`}
      />
      {!online ? (
        <span>Offline · {count} saved on device</span>
      ) : flushing ? (
        <span>Uploading {count}…</span>
      ) : (
        <>
          <span>{count} to upload</span>
          <button onClick={flush} className="font-semibold underline">
            Retry
          </button>
        </>
      )}
    </div>
  );
}
