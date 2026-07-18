import { Card } from "@/components/ui";

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

function Stat({ value, label, hint }: { value: React.ReactNode; label: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      {hint && <p className="text-[11px] text-zinc-400">{hint}</p>}
    </div>
  );
}

const TG_LABEL: Record<string, string> = {
  children_0_3: "Children 0–3",
  children_4_12: "Children 4–12",
  youth: "Youth 13–24",
  women: "Women 15–49",
  elderly: "Elderly 60+",
};

export default function WeeklyDashboard({ dashboard }: { dashboard: Dash | null }) {
  if (!dashboard) return null;
  const d = dashboard;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat value={`${d.settlementsCovered}/${d.totalSettlements}`} label="Settlements covered" />
        <Stat value={`${d.mobiliserDeployment}/${d.totalMobilisers}`} label="Mobilisers active" />
        <Stat value={d.householdsWeek} label="Households surveyed (week)" />
        <Stat value={`${d.householdsCumulative}/${d.targetHouseholds}`} label="Cumulative households" />
        <Stat value={d.followupHouseholds} label="Households need follow-up" />
        <Stat value={d.urgentHealth} label="Urgent health cases" />
        <Stat value={d.pregnant} label="Pregnant / new mothers" />
        <Stat value={d.entitlementGaps} label="Entitlement gaps" />
      </div>

      <Card>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          CM daily reports (this week)
        </p>
        <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
          <div><p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{d.dailyReports}</p><p className="text-zinc-500">Reports filed</p></div>
          <div><p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{d.dailySurveysReported}</p><p className="text-zinc-500">Surveys reported</p></div>
          <div><p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{d.dailyUrgentCases}</p><p className="text-zinc-500">Urgent cases</p></div>
          <div><p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{d.dailyFollowUps}</p><p className="text-zinc-500">Follow-ups</p></div>
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Target groups (cumulative)
        </p>
        <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
          {Object.entries(d.targets).map(([k, v]) => (
            <div key={k}>
              <p className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{v}</p>
              <p className="text-zinc-500">{TG_LABEL[k] || k}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
          Settlement coverage (week / cumulative)
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {d.settlementSplit.map((s) => (
                <tr key={s.code} className="border-b border-zinc-100 last:border-0 dark:border-zinc-900">
                  <td className="py-1.5 text-zinc-700 dark:text-zinc-300">{s.label}</td>
                  <td className="py-1.5 text-right font-medium text-zinc-900 dark:text-zinc-100">{s.week}</td>
                  <td className="w-12 py-1.5 text-right text-zinc-400">{s.cumulative}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
