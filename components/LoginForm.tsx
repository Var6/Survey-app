"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Mobile networks in the field drop single requests often — retry quietly. */
const ATTEMPTS = 3;
const TIMEOUT_MS = 20000;

function homeFor(role: string): string {
  if (role === "director") return "/director";
  if (role === "accountant") return "/finance";
  if (role === "programme_manager") return "/pm";
  if (role === "mis") return "/mis";
  return "/cm";
}

export default function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    // Reason the last attempt failed — only shown once all retries are spent.
    let problem = "Login failed";

    for (let n = 1; n <= ATTEMPTS; n++) {
      setAttempt(n);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
          signal: controller.signal,
          cache: "no-store",
        });

        // Read as text first: a platform error page (gateway timeout, crash)
        // is HTML, and blindly calling res.json() on it throws — which is what
        // used to surface as a bogus "Network error".
        const raw = await res.text();
        let data: { user?: { role?: string }; error?: string } | null = null;
        try {
          data = raw ? JSON.parse(raw) : null;
        } catch {
          data = null;
        }

        if (res.ok && data?.user?.role) {
          const dest =
            next && next.startsWith("/") && next !== "/"
              ? next
              : homeFor(data.user.role);
          router.replace(dest);
          router.refresh();
          return;
        }

        if (data?.error && res.status < 500) {
          // A real answer from our API (wrong password, inactive account).
          setError(data.error);
          setLoading(false);
          setAttempt(0);
          return;
        }

        // 5xx, or a non-JSON body — the server/platform is struggling. Retry.
        problem = data?.error
          ? `Server error (${res.status}): ${data.error}`
          : `Server did not respond properly (HTTP ${res.status})`;
        console.error("[login] bad response", res.status, raw.slice(0, 200));
      } catch (err) {
        const name = (err as Error)?.name;
        if (typeof navigator !== "undefined" && !navigator.onLine) {
          setError("इंटरनेट बंद है — कनेक्शन जाँचकर दोबारा कोशिश करें।");
          setLoading(false);
          setAttempt(0);
          return;
        }
        problem =
          name === "AbortError"
            ? "सर्वर ने समय पर जवाब नहीं दिया (timeout)"
            : "नेटवर्क बीच में टूट गया";
        console.error("[login] request failed", err);
      } finally {
        clearTimeout(timer);
      }

      // Brief backoff before the next try.
      if (n < ATTEMPTS) {
        await new Promise((r) => setTimeout(r, 500 * n));
      }
    }

    setError(`${problem} — ${ATTEMPTS} बार कोशिश की। थोड़ी देर बाद फिर करें।`);
    setLoading(false);
    setAttempt(0);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email
        </label>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          placeholder="you@janmanindia.org"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Password
        </label>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2.5 text-base text-zinc-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          placeholder="••••••••"
        />
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal-700 px-4 py-2.5 text-base font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? attempt > 1
            ? `दोबारा कोशिश… (${attempt}/${ATTEMPTS})`
            : "Signing in…"
          : "Sign in"}
      </button>
    </form>
  );
}
