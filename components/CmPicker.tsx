"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/client";
import { inputCls } from "./case-ui";

export interface CmOption {
  id: string;
  name: string;
  code: string | null;
}

/**
 * Multi-select for Community Mobilisers: search by name, tick any number,
 * see who is selected and remove them again before saving.
 */
export default function CmPicker({
  value,
  onChange,
  excludeId,
  label,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  /** Hide one CM (e.g. the organiser — they cannot tag themselves). */
  excludeId?: string;
  label: string;
}) {
  const [all, setAll] = useState<CmOption[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ cms: CmOption[] }>("/api/cms")
      .then((r) => setAll(r.cms))
      .catch((e) => setErr((e as Error).message));
  }, []);

  const options = useMemo(
    () => all.filter((c) => c.id !== excludeId),
    [all, excludeId]
  );
  const byId = useMemo(() => new Map(options.map((c) => [c.id, c])), [options]);
  const shown = options.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {label} {value.length > 0 && <span className="text-teal-600">· {value.length} selected</span>}
      </span>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((id) => (
            <span
              key={id}
              className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-800 dark:bg-teal-950/60 dark:text-teal-200"
            >
              {byId.get(id)?.name ?? "CM"}
              <button
                type="button"
                onClick={() => toggle(id)}
                aria-label={`Remove ${byId.get(id)?.name ?? "CM"}`}
                className="rounded-full px-1 text-teal-700 hover:bg-teal-200 dark:text-teal-200 dark:hover:bg-teal-900"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name…"
        className={inputCls}
        aria-label={`Search ${label}`}
      />
      {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
      <ul className="mt-2 max-h-44 divide-y divide-zinc-100 overflow-y-auto rounded-lg border border-zinc-200 dark:divide-zinc-900 dark:border-zinc-800">
        {shown.length === 0 ? (
          <li className="px-3 py-3 text-sm text-zinc-400">No match.</li>
        ) : (
          shown.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900">
                <input
                  type="checkbox"
                  checked={value.includes(c.id)}
                  onChange={() => toggle(c.id)}
                  className="h-4 w-4"
                />
                <span className="flex-1 text-zinc-800 dark:text-zinc-100">{c.name}</span>
                {c.code && <span className="text-xs text-zinc-400">{c.code}</span>}
              </label>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
