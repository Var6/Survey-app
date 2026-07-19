import Link from "next/link";
import Image from "next/image";

export const metadata = { title: "Page not found · Janman" };

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 text-center dark:bg-black">
      <Image
        src="/logo-mark.png"
        alt="Janman"
        width={56}
        height={56}
        className="mb-6 rounded-2xl"
      />
      <p className="text-6xl font-bold tabular-nums text-teal-600">404</p>
      <h1 className="mt-3 text-xl font-bold text-zinc-900 dark:text-zinc-50">
        Page not found
      </h1>
      <p className="mt-1 max-w-sm text-sm text-zinc-500 dark:text-zinc-400">
        यह पेज मौजूद नहीं है। The page you are looking for doesn&apos;t exist or
        may have been moved.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/"
          className="rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-800"
        >
          Go to home
        </Link>
        <Link
          href="/login"
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          Login
        </Link>
      </div>
    </div>
  );
}
