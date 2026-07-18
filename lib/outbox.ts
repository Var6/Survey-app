/**
 * Offline survey outbox (client-only).
 *
 * When a mobiliser submits a survey without a working connection, the payload
 * is queued in localStorage and uploaded later by OfflineSync — on reconnect
 * and on a 30s timer. Only the survey JSON is stored (no images).
 */

export interface OutboxItem {
  tempId: string;
  payload: unknown;
  label: string;
  createdAt: number;
}

const KEY = "janman:survey-outbox";
export const OUTBOX_EVENT = "janman-outbox-change";

function read(): OutboxItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
  } catch {
    return [];
  }
}

function write(items: OutboxItem[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(OUTBOX_EVENT));
}

export function enqueueSurvey(payload: unknown, label: string): OutboxItem {
  const item: OutboxItem = {
    tempId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    payload,
    label,
    createdAt: Date.now(),
  };
  write([...read(), item]);
  return item;
}

export function outboxItems(): OutboxItem[] {
  return read();
}

export function removeOutbox(tempId: string): void {
  write(read().filter((i) => i.tempId !== tempId));
}

export function outboxCount(): number {
  return read().length;
}
