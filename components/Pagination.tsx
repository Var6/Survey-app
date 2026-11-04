"use client";

/**
 * Page controls for server-paged lists: "Showing 101–200 of 1,650", Previous /
 * Next and numbered pages. The caller fetches the page from the server — this
 * component only renders the controls.
 */
export default function Pagination({
  page,
  pages,
  total,
  pageSize,
  onPage,
  busy,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  busy?: boolean;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // 1 … 4 5 [6] 7 8 … 17
  const nums: (number | "gap")[] = [];
  const add = (n: number) => {
    if (n >= 1 && n <= pages && !nums.includes(n)) nums.push(n);
  };
  add(1);
  for (let n = page - 2; n <= page + 2; n++) add(n);
  add(pages);
  nums.sort((a, b) => (a as number) - (b as number));
  const withGaps: (number | "gap")[] = [];
  nums.forEach((n, i) => {
    if (i > 0 && (n as number) - (nums[i - 1] as number) > 1) withGaps.push("gap");
    withGaps.push(n);
  });

  const btn =
    "min-w-9 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40";
  const idle =
    "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900";

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 print:hidden"
    >
      <p className="text-sm text-zinc-500 dark:text-zinc-400" aria-live="polite">
        Showing <span className="font-semibold text-zinc-700 dark:text-zinc-200">
          {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")}
        </span>{" "}
        of <span className="font-semibold text-zinc-700 dark:text-zinc-200">{total.toLocaleString("en-IN")}</span>{" "}
        record{total === 1 ? "" : "s"}
      </p>
      {pages > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={`${btn} ${idle}`}
            disabled={busy || page <= 1}
            onClick={() => onPage(page - 1)}
          >
            ← Previous
          </button>
          <div className="hidden items-center gap-1.5 sm:flex">
            {withGaps.map((n, i) =>
              n === "gap" ? (
                <span key={`g${i}`} className="px-1 text-zinc-400">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  disabled={busy}
                  aria-current={n === page ? "page" : undefined}
                  className={`${btn} ${
                    n === page ? "border-teal-600 bg-teal-600 text-white" : idle
                  }`}
                  onClick={() => onPage(n)}
                >
                  {n}
                </button>
              )
            )}
          </div>
          <span className="px-1 text-sm text-zinc-500 sm:hidden">
            {page} / {pages}
          </span>
          <button
            type="button"
            className={`${btn} ${idle}`}
            disabled={busy || page >= pages}
            onClick={() => onPage(page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </nav>
  );
}
