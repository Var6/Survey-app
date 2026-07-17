import Image from "next/image";
import LogoutButton from "./LogoutButton";
import ThemeToggle from "./ThemeToggle";

export default function AppHeader({
  name,
  roleLabel,
  avatarUrl,
}: {
  name: string;
  roleLabel: string;
  avatarUrl?: string | null;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
      <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 overflow-hidden rounded-lg bg-zinc-900">
            {avatarUrl ? (
              // Remote R2 image — plain img avoids next/image remotePatterns config.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt={name}
                className="h-full w-full object-cover"
              />
            ) : (
              <Image
                src="/logo-mark.png"
                alt="Janman"
                width={32}
                height={32}
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              {name}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{roleLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
