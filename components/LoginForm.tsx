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
  const [showPassword, setShowPassword] = useState(false);

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
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 bg-white py-2.5 pl-3 pr-11 text-base text-zinc-900 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            title={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-zinc-500 transition hover:text-zinc-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-600/40 dark:hover:text-zinc-200"
          >
            {showPassword ? (
              // eye with a slash — password is visible, click to hide
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 3l18 18" />
                <path d="M10.6 10.6a2 2 0 002.8 2.8" />
                <path d="M9.4 5.2A9.5 9.5 0 0112 5c5 0 9 4.5 9 7a11 11 0 01-2.3 3.2M6.2 6.7A11.6 11.6 0 003 12c0 2.5 4 7 9 7a9.6 9.6 0 003.9-.8" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M3 12s3.6-7 9-7 9 7 9 7-3.6 7-9 7-9-7-9-7z" />
                <circle cx="12" cy="12" r="2.6" />
              </svg>
            )}
          </button>
        </div>
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
