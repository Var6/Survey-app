/**
 * Small client-side fetch helper. Throws on non-2xx with the API error text.
 *
 * Reads (GET/HEAD) are retried a couple of times: field phones drop single
 * requests routinely even when the connection is otherwise fine. Writes are
 * never retried — a resent POST would create a duplicate survey/report — and
 * network failures keep rethrowing the original TypeError so callers can still
 * detect "offline" and queue the submission.
 */
const READ_RETRIES = 2;

function isRead(init?: RequestInit): boolean {
  const method = (init?.method || "GET").toUpperCase();
  return method === "GET" || method === "HEAD";
}

export async function apiFetch<T = unknown>(
  url: string,
  init?: RequestInit
): Promise<T> {
  const isForm = init?.body instanceof FormData;
  const attempts = isRead(init) ? READ_RETRIES + 1 : 1;
  let lastError: unknown;

  for (let n = 1; n <= attempts; n++) {
    try {
      const res = await fetch(url, {
        ...init,
        headers: {
          ...(init?.body && !isForm ? { "Content-Type": "application/json" } : {}),
          ...(init?.headers || {}),
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // 5xx and gateway errors are worth another try; 4xx are not.
        if (res.status >= 500 && n < attempts) {
          lastError = new Error(`Request failed (${res.status})`);
        } else {
          throw new Error(
            (data as { error?: string }).error || `Request failed (${res.status})`
          );
        }
      } else {
        return data as T;
      }
    } catch (e) {
      // Rethrow immediately on the final attempt, preserving the error type.
      if (n >= attempts) throw e;
      lastError = e;
    }
    await new Promise((r) => setTimeout(r, 400 * n));
  }
  throw lastError instanceof Error ? lastError : new Error("Request failed");
}

export function formatMoney(amount: number, currency = "INR"): string {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `₹${amount}`;
  }
}

export function formatDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
