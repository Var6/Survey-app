import { Card } from "@/components/ui";
import { ProgressRing, StatTile, HBars } from "@/components/charts";

interface Split {
  code: string;
  label: string;
  week: number;
  cumulative: number;
}
interface Dash {
  settlementsCovered: number;
  totalSettlements: number;
  mobiliserDeployment: number;
  totalMobilisers: number;
  householdsWeek: number;
  householdsCumulative: number;
  targetHouseholds: number;
  followupHouseholds: number;
  urgentHealth: number;
  pregnant: number;
  entitlementGaps: number;
  pwd: number;
  widow: number;
  targets: Record<string, number>;
  settlementSplit: Split[];
  dailyReports: number;
  dailySurveysReported: number;
  dailyUrgentCases: number;
  dailyFollowUps: number;
}

const TG_LABEL: Record<string, string> = {
  children_0_3: "Children 0–3",
  children_4_12: "Children 4–12",
  youth: "Youth 13–24",
  women: "Women 15–49",
  elderly: "Elderly 60+",
};
const TG_COLOR: Record<string, string> = {
  children_0_3: "bg-sky-500",
  children_4_12: "bg-amber-500",
  youth: "bg-indigo-500",
  women: "bg-pink-500",
  elderly: "bg-emerald-500",
};

function Ring({
  value,
  max,
  label,
  color = "text-teal-600",
}: {
  value: number;
  max: number;
  label: string;
  color?: string;
}) {
  return (
    <Card className="flex items-center gap-4">
      <ProgressRing value={value} max={max} size={96} stroke={10} color={color}>
        <span className="text-lg font-bold tabular-nums text-zinc-900 dark:text-zinc-50">
          {value}
        </span>
        <span className="text-[10px] text-zinc-400">of {max}</span>
      </ProgressRing>
      <div>
        <p className="text-sm font-medium leading-tight text-zinc-600 dark:text-zinc-300">
          {label}
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-zinc-400">
          {max > 0 ? Math.round((value / max) * 100) : 0}%
        </p>
      </div>
    </Card>
  );
}

export default function WeeklyDashboard({
  dashboard,
  periodLabel = "week",
}: {
  dashboard: Dash | null;
  periodLabel?: string;
}) {
  if (!dashboard) return null;
  const d = dashboard;
  const maxCum = Math.max(1, ...d.settlementSplit.map((s) => s.cumulative));

  return (
    <div className="space-y-4">
      {/* Coverage rings */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Ring
          value={d.settlementsCovered}
          max={d.totalSettlements}
          label={`Settlements covered this ${periodLabel}`}
        />
        <Ring
          value={d.mobiliserDeployment}
          max={d.totalMobilisers}
          label={`Mobilisers active this ${periodLabel}`}
          color="text-indigo-500"
        />
        <Ring
          value={d.householdsCumulative}
          max={d.targetHouseholds}
          label="Households surveyed (cumulative)"
          color="text-emerald-500"
        />
      </div>

      {/* Headline tiles */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label={`Households surveyed (${periodLabel})`} value={d.householdsWeek} />
        <StatTile label="Households need follow-up" value={d.followupHouseholds} />
        <StatTile
          label="Urgent health cases"
          value={d.urgentHealth}
          tone={d.urgentHealth > 0 ? "alert" : "normal"}
        />
        <StatTile
          label="Pregnant / new mothers"
          value={d.pregnant}
          tone={d.pregnant > 0 ? "warn" : "normal"}
        />
        <StatTile label="Entitlement gaps" value={d.entitlementGaps} />
        <StatTile label="PWD households" value={d.pwd} hint={`${d.widow} widow / single women`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Target groups bar chart */}
        <Card>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Target groups (cumulative)
          </p>
          <HBars
            data={Object.entries(d.targets).map(([k, v]) => ({
              label: TG_LABEL[k] || k,
              value: v,
              className: TG_COLOR[k] || "bg-teal-500",
            }))}
          />
        </Card>

        {/* Settlement coverage: cumulative track + this-period overlay */}
        <Card>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Settlement coverage
          </p>
          <p className="mb-3 flex items-center gap-3 text-[11px] text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-teal-600" /> this {periodLabel}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-teal-200 dark:bg-teal-900" />{" "}
              cumulative
            </span>
          </p>
          <div className="space-y-2">
            {d.settlementSplit.map((s) => (
              <div key={s.code} className="flex items-center gap-3">
                <div
                  className="w-32 shrink-0 truncate text-xs text-zinc-500 dark:text-zinc-400"
                  title={s.label}
                >
                  {s.label}
                </div>
                <div className="relative h-5 flex-1 overflow-hidden rounded-md bg-zinc-100 dark:bg-zinc-900">
                  <div
                    className="absolute inset-y-0 left-0 rounded-md bg-teal-200 dark:bg-teal-900"
                    style={{ width: `${(s.cumulative / maxCum) * 100}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded-md bg-teal-600"
                    style={{
                      width: `${Math.max((s.week / maxCum) * 100, s.week > 0 ? 3 : 0)}%`,
                    }}
                  />
                </div>
                <div className="w-16 shrink-0 text-right text-xs tabular-nums text-zinc-600 dark:text-zinc-300">
                  <span className="font-semibold">{s.week}</span>
                  <span className="text-zinc-400"> / {s.cumulative}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* CM daily reports */}
      <Card>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          CM daily reports (this {periodLabel})
        </p>
        <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
          <div>
            <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {d.dailyReports}
            </p>
            <p className="text-zinc-500">Reports filed</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {d.dailySurveysReported}
            </p>
            <p className="text-zinc-500">Surveys reported</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {d.dailyUrgentCases}
            </p>
            <p className="text-zinc-500">Urgent cases</p>
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-zinc-900 dark:text-zinc-100">
              {d.dailyFollowUps}
            </p>
            <p className="text-zinc-500">Follow-ups</p>
          </div>
        </div>
      </Card>
    </div>
  );
}
