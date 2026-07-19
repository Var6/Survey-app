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
  /** When true, only highlight on an exact path match. */
  exact?: boolean;
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
  collapsed,
  onNavigate,
}: {
  nav: ShellNavGroup[];
  homeHref: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const path = usePathname();
  return (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {nav.map((group, gi) => (
        <div key={gi}>
          {group.label && !collapsed && (
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
              {group.label}
            </p>
          )}
          {group.label && collapsed && (
            <div className="mx-2 mb-2 border-t border-zinc-200 dark:border-zinc-800" />
          )}
          <ul className="space-y-0.5">
            {group.items.map((it) => {
              const active = it.exact
                ? path === it.href
                : isActive(path, it.href, homeHref);
              const IconCmp = it.icon ? Icon[it.icon] : null;
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    title={collapsed ? it.label : undefined}
                    className={`flex items-center rounded-lg px-2.5 py-2 text-sm font-medium transition ${
                      collapsed ? "justify-center" : "gap-2.5"
                    } ${
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
                    {!collapsed && <span className="truncate">{it.label}</span>}
                    {!collapsed && it.badge !== undefined && it.badge > 0 && (
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

function Brand({
  collapsed,
  onToggle,
}: {
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  const inner = (
    <>
      <Image src="/logo-mark.png" alt="Janman" width={32} height={32} className="rounded-lg" />
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Janman</p>
          <p className="text-[11px] text-zinc-400">Field Programme</p>
        </div>
      )}
    </>
  );
  const cls = `flex h-16 w-full items-center border-b border-zinc-200 dark:border-zinc-800 ${
    collapsed ? "justify-center px-2" : "gap-2.5 px-5"
  }`;
  // The logo itself is the collapse/expand control on desktop.
  if (onToggle) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className={`${cls} cursor-pointer text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900`}
      >
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

function UserFooter({
  name,
  roleLabel,
  avatarUrl,
  collapsed,
}: {
  name: string;
  roleLabel: string;
  avatarUrl?: string | null;
  collapsed?: boolean;
}) {
  return (
    <div className="border-t border-zinc-200 px-3 py-3 dark:border-zinc-800">
      <div className={`flex items-center px-1 ${collapsed ? "justify-center" : "gap-2.5"}`}>
        <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-zinc-800" title={collapsed ? `${name} · ${roleLabel}` : undefined}>
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
          ) : (
            <Image src="/logo-mark.png" alt={name} width={32} height={32} className="h-full w-full object-cover" />
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{name}</p>
            <p className="truncate text-[11px] text-zinc-400">{roleLabel}</p>
          </div>
        )}
      </div>
      <div className={`mt-2.5 flex items-center gap-2 ${collapsed ? "flex-col" : ""}`}>
        <ThemeToggle />
        {!collapsed && <LogoutButton />}
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
  const [collapsed, setCollapsed] = useState(false);
  const path = usePathname();

  // Restore the persisted collapse preference.
  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("sidebar-collapsed") === "1");
    } catch {
      /* ignore */
    }
  }, []);
  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });
  };

  // Close the mobile drawer on navigation.
  useEffect(() => {
    setOpen(false);
  }, [path]);

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 dark:border-zinc-800 dark:bg-zinc-950 lg:flex ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        <Brand collapsed={collapsed} onToggle={toggleCollapsed} />
        <NavLinks nav={nav} homeHref={homeHref} collapsed={collapsed} />
        <UserFooter name={name} roleLabel={roleLabel} avatarUrl={avatarUrl} collapsed={collapsed} />
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
      <main className={collapsed ? "lg:pl-16" : "lg:pl-64"}>
        {/* Desktop top band — its bottom border runs at the same height as the
            brand divider, so the line continues seamlessly across the page. */}
        <div className="sticky top-0 z-10 hidden h-16 items-center justify-end border-b border-zinc-200 bg-white px-6 dark:border-zinc-800 dark:bg-zinc-950 lg:flex">
          <span className="text-xs text-zinc-400">
            {roleLabel} ·{" "}
            {new Date().toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
