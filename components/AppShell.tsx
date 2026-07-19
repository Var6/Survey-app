"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import ThemeToggle from "./ThemeToggle";
import LogoutButton from "./LogoutButton";
import { Icon, IconName } from "./icons";

export interface ShellNavItem {
  href: string;
  label: string;
  icon?: IconName;
  badge?: number;
}
export interface ShellNavGroup {
  label?: string;
  items: ShellNavItem[];
}

function isActive(path: string, href: string, homeHref: string) {
  if (href === homeHref) return path === href;
  return path === href || path.startsWith(href + "/");
}

function NavLinks({
  nav,
  homeHref,
  onNavigate,
}: {
  nav: ShellNavGroup[];
  homeHref: string;
  onNavigate?: () => void;
}) {
  const path = usePathname();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {nav.map((group, gi) => (
        <div key={gi}>
          {group.label && (
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {group.label}
            </p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((it) => {
              const active = isActive(path, it.href, homeHref);
              const IconCmp = it.icon ? Icon[it.icon] : null;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-teal-600 text-white shadow-sm"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    }`}
                  >
                    {IconCmp && (
                      <IconCmp
                        className={active ? "text-white" : "text-zinc-400 dark:text-zinc-500"}
                      />
                    )}
                    <span className="truncate">{it.label}</span>
                    {it.badge !== undefined && it.badge > 0 && (
                      <span
                        className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                          active
                            ? "bg-white/25 text-white"
                            : "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                        }`}
                      >
                        {it.badge}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
      <Image src="/logo-mark.png" alt="Janman" width={32} height={32} className="rounded-lg" />
      <div className="leading-tight">
        <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Janman</p>
        <p className="text-[11px] text-zinc-400">Field Programme</p>
      </div>
    </div>
  );
}

function UserFooter({
  name,
  roleLabel,
  avatarUrl,
}: {
  name: string;
  roleLabel: string;
  avatarUrl?: string | null;
}) {
  return (
    <div className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
      <div className="flex items-center gap-2.5 px-1">
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-800">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <Image src="/logo-mark.png" alt={name} width={32} height={32} className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{name}</p>
          <p className="truncate text-[11px] text-zinc-400">{roleLabel}</p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center gap-2">
        <ThemeToggle />
        <LogoutButton />
      </div>
    </div>
  );
}

export default function AppShell({
  name,
  roleLabel,
  avatarUrl,
  homeHref,
  nav,
  children,
}: {
  name: string;
  roleLabel: string;
  avatarUrl?: string | null;
  homeHref: string;
  nav: ShellNavGroup[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  // Close the mobile drawer on navigation.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950 lg:flex">
        <Brand />
        <NavLinks nav={nav} homeHref={homeHref} />
        <UserFooter name={name} roleLabel={roleLabel} avatarUrl={avatarUrl} />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-black/80 lg:hidden">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setOpen(true)}
            aria-label="Open menu"
            className="rounded-lg p-1.5 text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
          >
            <Icon.menu />
          </button>
          <Image src="/logo-mark.png" alt="Janman" width={26} height={26} className="rounded-md" />
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">{roleLabel}</span>
        </div>
        <ThemeToggle />
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <div className="relative">
              <Brand />
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
              >
                <Icon.close />
              </button>
            </div>
            <NavLinks nav={nav} homeHref={homeHref} onNavigate={() => setOpen(false)} />
            <UserFooter name={name} roleLabel={roleLabel} avatarUrl={avatarUrl} />
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
