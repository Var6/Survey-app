import Image from "next/image";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Sign in · Janman Survey" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 h-16 w-16 overflow-hidden rounded-2xl bg-zinc-900 shadow-sm">
            <Image
              src="/logo-mark.png"
              alt="Janman"
              width={64}
              height={64}
              className="h-full w-full object-cover"
              priority
            />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Janman Survey
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Purnea Urban Initiative — household baseline
          </p>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Janman People&apos;s Foundation
        </p>
      </div>
    </main>
  );
}
