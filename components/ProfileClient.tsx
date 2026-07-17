"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/client";
import type { PublicUser } from "@/lib/serialize";
import { Card, inputClass, labelClass, btnPrimary } from "@/components/ui";
import { SETTLEMENT_BY_CODE } from "@/lib/questionnaire/settlements";

export default function ProfileClient() {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // password
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [pwErr, setPwErr] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ user: PublicUser }>("/api/profile")
      .then(({ user }) => {
        setUser(user);
        setName(user.name);
        setPhone(user.phone || "");
      })
      .catch((e) => setErr(e.message));
  }, []);

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setMsg(null);
    try {
      const { user } = await apiFetch<{ user: PublicUser }>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify({ name, phone }),
      });
      setUser(user);
      setMsg("Profile updated");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function uploadAvatar(file: File) {
    setErr(null);
    setMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { user } = await apiFetch<{ user: PublicUser }>(
        "/api/profile/avatar",
        { method: "POST", body: fd }
      );
      setUser(user);
      setMsg("Photo updated");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwErr(null);
    setPwMsg(null);
    if (newPw !== confirmPw) {
      setPwErr("New passwords do not match");
      return;
    }
    try {
      await apiFetch("/api/profile/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword: curPw, newPassword: newPw }),
      });
      setPwMsg("Password changed");
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (e) {
      setPwErr((e as Error).message);
    }
  }

  if (!user) {
    return <p className="text-sm text-zinc-500">{err || "Loading…"}</p>;
  }

  const communities = (user.communities || [])
    .map((c) => SETTLEMENT_BY_CODE[c]?.label || c)
    .join(", ");

  return (
    <div className="space-y-5">
      {/* Avatar + identity */}
      <Card>
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            {user.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt={user.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-bold text-zinc-500">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
              {user.name}
            </p>
            <p className="truncate text-sm text-zinc-500">{user.email}</p>
            <button
              onClick={() => fileRef.current?.click()}
              className="mt-1 text-sm font-medium text-teal-700 dark:text-teal-400"
            >
              Change photo
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadAvatar(f);
              }}
            />
          </div>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-zinc-500">Role</dt>
            <dd className="font-medium capitalize text-zinc-900 dark:text-zinc-100">
              {user.role === "cm" ? "Community Mobiliser" : "Director"}
            </dd>
          </div>
          {user.mobiliserCode && (
            <div>
              <dt className="text-zinc-500">Mobiliser code</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {user.mobiliserCode}
              </dd>
            </div>
          )}
          {communities && (
            <div className="col-span-2">
              <dt className="text-zinc-500">Settlements</dt>
              <dd className="font-medium text-zinc-900 dark:text-zinc-100">
                {communities}
              </dd>
            </div>
          )}
        </dl>
      </Card>

      {/* Edit details */}
      <Card>
        <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">
          Details
        </h2>
        <form onSubmit={saveDetails} className="space-y-3">
          <div>
            <label className={labelClass}>Name</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Phone</label>
            <input
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="10-digit number"
            />
          </div>
          {msg && <p className="text-sm text-teal-700 dark:text-teal-400">{msg}</p>}
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button type="submit" className={btnPrimary}>
            Save details
          </button>
        </form>
      </Card>

      {/* Change password */}
      <Card>
        <h2 className="mb-3 font-semibold text-zinc-900 dark:text-zinc-50">
          Change password
        </h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className={labelClass}>Current password</label>
            <input
              type="password"
              className={inputClass}
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>New password</label>
            <input
              type="password"
              className={inputClass}
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              required
            />
          </div>
          <div>
            <label className={labelClass}>Confirm new password</label>
            <input
              type="password"
              className={inputClass}
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              required
            />
          </div>
          {pwMsg && (
            <p className="text-sm text-teal-700 dark:text-teal-400">{pwMsg}</p>
          )}
          {pwErr && <p className="text-sm text-red-600">{pwErr}</p>}
          <button type="submit" className={btnPrimary}>
            Update password
          </button>
        </form>
      </Card>
    </div>
  );
}
