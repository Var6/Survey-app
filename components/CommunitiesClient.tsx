"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { Card, Empty, inputClass, labelClass, btnPrimary, btnGhost } from "@/components/ui";

interface Settlement {
  id: string;
  code: string;
  label: string;
  hhPrefix: string;
  active: boolean;
  order: number;
  surveyCount: number;
}
interface Mobiliser {
  id: string;
  name: string;
  mobiliserCode: string | null;
  communities: string[];
  active: boolean;
}

export default function CommunitiesClient() {
  const [rows, setRows] = useState<Settlement[]>([]);
  const [cms, setCms] = useState<Mobiliser[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [newLabel, setNewLabel] = useState("");
  const [newPrefix, setNewPrefix] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ settlements }, { users }] = await Promise.all([
        apiFetch<{ settlements: Settlement[] }>("/api/settlements?includeInactive=1"),
        apiFetch<{ users: Mobiliser[] }>("/api/users?role=cm"),
      ]);
      setRows(settlements);
      setCms(users);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function run(fn: () => Promise<unknown>, okMsg: string) {
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      await fn();
      setMsg(okMsg);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const label = newLabel.trim();
    if (!label) return;
    run(
      () =>
        apiFetch("/api/settlements", {
          method: "POST",
          body: JSON.stringify({ label, hhPrefix: newPrefix.trim() || undefined }),
        }).then(() => {
          setNewLabel("");
          setNewPrefix("");
        }),
      `“${label}” added`
    );
  };

  const rename = (s: Settlement) =>
    run(
      () =>
        apiFetch(`/api/settlements/${s.id}`, {
          method: "PATCH",
          body: JSON.stringify({ label: editLabel.trim() }),
        }).then(() => setEditing(null)),
      "Community renamed"
    );

  const toggleActive = (s: Settlement) =>
    run(
      () =>
        apiFetch(`/api/settlements/${s.id}`, {
          method: "PATCH",
          body: JSON.stringify({ active: !s.active }),
        }),
      s.active ? `“${s.label}” retired` : `“${s.label}” restored`
    );

  const remove = (s: Settlement) => {
    if (!window.confirm(`Delete “${s.label}” permanently?`)) return;
    run(() => apiFetch(`/api/settlements/${s.id}`, { method: "DELETE" }), `“${s.label}” deleted`);
  };

  const toggleAssign = (cm: Mobiliser, code: string) => {
    const next = cm.communities.includes(code)
      ? cm.communities.filter((c) => c !== code)
      : [...cm.communities, code];
    run(
      () =>
        apiFetch(`/api/users/${cm.id}/communities`, {
          method: "PATCH",
          body: JSON.stringify({ communities: next }),
        }),
      `${cm.name} updated`
    );
  };

  if (loading) return <p className="text-sm text-zinc-500">Loading…</p>;

  const activeRows = rows.filter((r) => r.active);

  return (
    <div className="space-y-5">
      {err && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {err}
        </p>
      )}
      {msg && <p className="text-sm text-teal-700 dark:text-teal-400">{msg}</p>}

      {/* Add a community */}
      <Card>
        <form onSubmit={create} className="space-y-3">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            Add a community
          </p>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div>
              <label className={labelClass}>Community name *</label>
              <input
                className={inputClass}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Housing Board"
                required
              />
            </div>
            <div>
              <label className={labelClass}>ID prefix</label>
              <input
                className={`${inputClass} w-24 uppercase`}
                value={newPrefix}
                onChange={(e) => setNewPrefix(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="auto"
              />
            </div>
            <div className="flex items-end">
              <button className={btnPrimary} disabled={busy}>
                + Add
              </button>
            </div>
          </div>
          <p className="text-xs text-zinc-500">
            The prefix starts every household ID in this community (e.g. HOU-M02-0001). Leave
            it blank and one is suggested from the name. The name can be changed later; the
            prefix cannot, because IDs already issued use it.
          </p>
        </form>
      </Card>

      {/* Communities */}
      <div>
        <h2 className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
          Communities ({activeRows.length} active)
        </h2>
        {rows.length === 0 ? (
          <Empty>No communities yet.</Empty>
        ) : (
          <div className="space-y-2">
            {rows.map((s) => (
              <Card key={s.id}>
                {editing === s.id ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="min-w-[200px] flex-1">
                      <label className={labelClass}>Community name</label>
                      <input
                        className={inputClass}
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <button className={btnPrimary} disabled={busy} onClick={() => rename(s)}>
                      Save
                    </button>
                    <button className={btnGhost} onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                        {s.label}{" "}
                        {!s.active && (
                          <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                            retired
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-zinc-500">
                        ID prefix {s.hhPrefix} · {s.surveyCount} survey
                        {s.surveyCount === 1 ? "" : "s"} ·{" "}
                        {cms.filter((c) => c.communities.includes(s.code)).length} mobiliser(s)
                      </p>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        className={btnGhost}
                        onClick={() => {
                          setEditing(s.id);
                          setEditLabel(s.label);
                        }}
                      >
                        ✎ Rename
                      </button>
                      <button className={btnGhost} disabled={busy} onClick={() => toggleActive(s)}>
                        {s.active ? "Retire" : "Restore"}
                      </button>
                      {s.surveyCount === 0 && (
                        <button
                          className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
                          disabled={busy}
                          onClick={() => remove(s)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Assignment grid */}
      <div>
        <h2 className="mb-2 text-sm font-bold text-zinc-900 dark:text-zinc-50">
          Who works where
        </h2>
        <p className="mb-2 text-xs text-zinc-500">
          Tick a community to assign it to that mobiliser; untick to take it away. A mobiliser
          with no community assigned can survey in any of them.
        </p>
        {cms.length === 0 ? (
          <Empty>No Community Mobilisers yet.</Empty>
        ) : (
          <div className="space-y-2">
            {cms.map((cm) => (
              <Card key={cm.id}>
                <p className="mb-1.5 font-semibold text-zinc-900 dark:text-zinc-50">
                  {cm.name}{" "}
                  {cm.mobiliserCode && (
                    <span className="text-xs font-normal text-zinc-400">· {cm.mobiliserCode}</span>
                  )}
                  {!cm.active && (
                    <span className="ml-1 rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      inactive
                    </span>
                  )}
                </p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {activeRows.map((s) => (
                    <label
                      key={s.code}
                      className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800"
                    >
                      <input
                        type="checkbox"
                        disabled={busy}
                        checked={cm.communities.includes(s.code)}
                        onChange={() => toggleAssign(cm, s.code)}
                      />
                      <span className="text-zinc-700 dark:text-zinc-300">{s.label}</span>
                    </label>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
