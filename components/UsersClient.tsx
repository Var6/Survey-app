"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/client";
import { Card, Empty, Badge, inputClass, labelClass, btnPrimary, btnGhost } from "@/components/ui";
import { SETTLEMENTS, MOBILISER_CODES } from "@/lib/questionnaire/settlements";

interface User {
  id: string;
  role: "director" | "cm" | "accountant";
  name: string;
  email: string;
  phone: string | null;
  mobiliserCode: string | null;
  projectId: string | null;
  communities: string[];
  active: boolean;
}
interface Project {
  id: string;
  name: string;
}

const ROLE_LABEL: Record<string, string> = {
  director: "Director",
  accountant: "Accountant",
  cm: "Community Mobiliser",
};
const ROLE_OPTIONS = [
  { value: "cm", label: "Community Mobiliser" },
  { value: "accountant", label: "Accountant (Finance)" },
  { value: "director", label: "Director" },
];

export default function UsersClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState<string | null>(null);

  const [role, setRole] = useState("cm");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [mobiliserCode, setMobiliserCode] = useState("");
  const [projectId, setProjectId] = useState("");
  const [communities, setCommunities] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const [u, p] = await Promise.all([
        apiFetch<{ users: User[] }>("/api/users"),
        apiFetch<{ projects: Project[] }>("/api/projects"),
      ]);
      setUsers(u.users);
      setProjects(p.projects);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function toggleCommunity(code: string) {
    setCommunities((c) => (c.includes(code) ? c.filter((x) => x !== code) : [...c, code]));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setCreated(null);
    setSaving(true);
    try {
      await apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          role,
          name,
          email,
          password,
          phone,
          mobiliserCode: role === "cm" ? mobiliserCode || undefined : undefined,
          projectId: role === "cm" ? projectId || undefined : undefined,
          communities: role === "cm" ? communities : [],
        }),
      });
      setCreated(`${name} (${ROLE_LABEL[role]})`);
      setName("");
      setEmail("");
      setPassword("");
      setPhone("");
      setMobiliserCode("");
      setCommunities([]);
      setShowForm(false);
      await load();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(u: User) {
    try {
      await apiFetch(`/api/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !u.active }),
      });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function resetPassword(u: User) {
    const newPassword = window.prompt(`New password for ${u.name} (min 6 chars):`);
    if (!newPassword) return;
    try {
      await apiFetch(`/api/users/${u.id}`, {
        method: "PATCH",
        body: JSON.stringify({ newPassword }),
      });
      setCreated(`Password reset for ${u.name}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const projectName = (id: string | null) => projects.find((p) => p.id === id)?.name || "—";
  const shown = filter ? users.filter((u) => u.role === filter) : users;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button className={btnPrimary} onClick={() => setShowForm((s) => !s)}>
          {showForm ? "Cancel" : "+ New user"}
        </button>
        <select className={inputClass} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">All roles</option>
          <option value="director">Directors</option>
          <option value="accountant">Accountants</option>
          <option value="cm">Mobilisers</option>
        </select>
      </div>

      {created && (
        <div className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800 dark:bg-teal-950/40 dark:text-teal-300">
          {created}. Share the login and ask them to change the password.
        </div>
      )}

      {showForm && (
        <Card>
          <form onSubmit={create} className="space-y-3">
            <div>
              <label className={labelClass}>Role *</label>
              <select className={inputClass} value={role} onChange={(e) => setRole(e.target.value)}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Full name *</label>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Email (login) *</label>
                <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div>
                <label className={labelClass}>Password *</label>
                <input className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
              </div>
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input className={inputClass} value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            {role === "cm" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>Mobiliser code</label>
                    <select className={inputClass} value={mobiliserCode} onChange={(e) => setMobiliserCode(e.target.value)}>
                      <option value="">—</option>
                      {MOBILISER_CODES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Project</label>
                    <select className={inputClass} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                      <option value="">—</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Assigned settlements</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SETTLEMENTS.map((s) => (
                      <label key={s.code} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2 py-1.5 text-sm dark:border-zinc-800">
                        <input type="checkbox" checked={communities.includes(s.code)} onChange={() => toggleCommunity(s.code)} />
                        <span className="text-zinc-700 dark:text-zinc-300">{s.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {err && <p className="text-sm text-red-600">{err}</p>}
            <button type="submit" className={btnPrimary} disabled={saving}>
              {saving ? "Creating…" : "Create user"}
            </button>
          </form>
        </Card>
      )}

      {err && !showForm && <p className="text-sm text-red-600">{err}</p>}

      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : shown.length === 0 ? (
        <Empty>No users yet.</Empty>
      ) : (
        <div className="space-y-3">
          {shown.map((u) => (
            <Card key={u.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                    {u.name}{" "}
                    {u.mobiliserCode && <span className="text-xs text-zinc-400">· {u.mobiliserCode}</span>}
                  </p>
                  <p className="truncate text-sm text-zinc-500">{u.email}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">
                    {ROLE_LABEL[u.role]}
                    {u.role === "cm"
                      ? ` · ${projectName(u.projectId)} · ${
                          u.communities.length
                            ? u.communities
                                .map((c) => SETTLEMENTS.find((s) => s.code === c)?.label || c)
                                .join(", ")
                            : "no settlements"
                        }`
                      : ""}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge value={u.active ? "active" : "inactive"} />
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button className={btnGhost} onClick={() => toggleActive(u)}>
                  {u.active ? "Deactivate" : "Activate"}
                </button>
                <button className={btnGhost} onClick={() => resetPassword(u)}>
                  Reset password
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
