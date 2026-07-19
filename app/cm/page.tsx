import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { surveysCol } from "@/lib/models";
import { SETTLEMENT_BY_CODE } from "@/lib/questionnaire/settlements";

export const metadata = { title: "Home · Mobiliser" };

async function getMyStats(mobiliserId: import("mongodb").ObjectId) {
  try {
    const surveys = await surveysCol();
    const [total, unsynced] = await Promise.all([
      surveys.countDocuments({ mobiliserId }),
      surveys.countDocuments({ mobiliserId, "sync.status": { $ne: "synced" } }),
    ]);
    return { total, unsynced };
  } catch {
    return null;
  }
}

export default async function CmHome() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const stats = await getMyStats(user._id!);
  const settlements = (user.communities || [])
    .map((c) => SETTLEMENT_BY_CODE[c]?.label || c)
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
          नमस्ते, {user.name}
        </h1>
        {settlements.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {settlements.map((s) => (
              <span
                key={s}
                className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-medium text-teal-800 dark:bg-teal-900/40 dark:text-teal-300"
              >
                {s}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            No settlements assigned yet.
          </p>
        )}
      </div>

      <Link
        href="/cm/survey/new"
        className="flex items-center justify-center rounded-2xl bg-teal-700 px-4 py-5 text-center text-base font-semibold text-white shadow-sm transition hover:bg-teal-800"
      >
        + नया सर्वे शुरू करें / Start new survey
      </Link>

      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {stats.total}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">My surveys</p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              {stats.unsynced}
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Saved, awaiting sync
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/cm/surveys"
          className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-teal-600"
        >
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            My surveys
          </p>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Review saved households
          </p>
        </Link>
        <Link
          href="/cm/requisitions"
          className="rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-teal-500 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-teal-600"
        >
          <p className="font-medium text-zinc-900 dark:text-zinc-50">
            Finance
          </p>
          <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
            Request an advance or claim expenses
          </p>
        </Link>
      </div>
    </div>
  );
}
