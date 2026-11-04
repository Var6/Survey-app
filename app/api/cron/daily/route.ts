import { json, handleError, HttpError } from "@/lib/api";
import { campsCol, monthlyReportsCol, usersCol } from "@/lib/models";
import { notifyUsers } from "@/lib/notifications";
import { syncCampToCalendar, gcalConfigured } from "@/lib/gcal";
import {
  MONTHLY_DEADLINE_DAY,
  REMINDER_DAYS_BEFORE,
  daysUntilDeadline,
  deadlineLabel,
  reportingMonthNow,
} from "@/lib/monthly/deadline";
import { istToday } from "@/lib/time";

export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Daily housekeeping, run by the scheduler in vercel.json (09:00 India time):
 *   1. Remind authors who have not yet filed last month's report — 3 days
 *      before, 1 day before and on the deadline day.
 *   2. Retry camps whose Google Calendar sync failed.
 *
 * Protected by CRON_SECRET (Vercel sends it as a Bearer token). Safe to run
 * twice: reminders are keyed per person, month and day, so nobody gets two.
 *
 * This does NOT submit anyone's report. Reports are only ever submitted by
 * their author.
 */
export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) throw new HttpError(503, "CRON_SECRET is not set on the server");
    if (req.headers.get("authorization") !== `Bearer ${secret}`) {
      throw new HttpError(401, "Unauthorized");
    }

    /* 1. Monthly report reminders */
    const month = reportingMonthNow();
    const left = daysUntilDeadline(month);
    let reminded = 0;
    if (REMINDER_DAYS_BEFORE.includes(left)) {
      const [y, m] = month.split("-").map(Number);
      const monthStart = new Date(Date.UTC(y, m - 1, 1));
      const filed = await (await monthlyReportsCol())
        .find(
          { monthStart, status: { $in: ["submitted", "approved"] } },
          { projection: { programmeManagerId: 1, authorRole: 1 } }
        )
        .toArray();
      const filedBy = new Set(filed.map((r) => String(r.programmeManagerId)));
      // Single-PM programme: one PM report for the month covers every PM.
      const pmFiled = filed.some((r) => (r.authorRole ?? "programme_manager") === "programme_manager");

      const authors = await (await usersCol())
        .find({ role: { $in: ["cm", "mis", "programme_manager"] }, active: { $ne: false } }, { projection: { _id: 1, role: 1 } })
        .toArray();
      const due = authors.filter(
        (u) => !filedBy.has(String(u._id)) && !(u.role === "programme_manager" && pmFiled)
      );
      const when = deadlineLabel(month);
      reminded = await notifyUsers(due.map((u) => u._id!), {
        category: "report_reminder",
        title:
          left === 0
            ? "Monthly report is due today"
            : `Monthly report due in ${left} day${left === 1 ? "" : "s"}`,
        body: `Your report for ${month} is due by the ${MONTHLY_DEADLINE_DAY}th (${when}). Open Monthly reports to submit it.`,
        relatedType: "monthly",
        dedupeKey: `report_reminder:${month}:${left}`,
      });
    }

    /* 2. Retry failed calendar syncs */
    let retried = 0;
    let recovered = 0;
    if (gcalConfigured()) {
      const camps = await campsCol();
      const todo = await camps
        .find(
          {
            "calendar.status": { $in: ["failed", "pending", "not_configured"] },
            "calendar.attempts": { $lt: 6 },
            date: { $gte: istToday() },
            status: { $ne: "completed" },
          },
          { projection: { _id: 1 } }
        )
        .limit(25)
        .toArray();
      for (const c of todo) {
        retried++;
        const state = await syncCampToCalendar(c._id!);
        if (state.status === "synced" || state.status === "cancelled") recovered++;
      }
    }

    return json({ ok: true, reportingMonth: month, daysLeft: left, reminded, calendar: { retried, recovered } });
  } catch (e) {
    return handleError(e);
  }
}
