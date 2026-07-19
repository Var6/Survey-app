"use client";

import { useRouter } from "next/navigation";

/** Navigates to the previous page (falls back to `href` when there is no history). */
export default function BackButton({
  href,
  label,
}: {
  href?: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back();
        } else if (href) {
          router.push(href);
        }
      }}
      className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:underline dark:text-teal-400"
    >
      ← {label || "Back"}
    </button>
  );
}
