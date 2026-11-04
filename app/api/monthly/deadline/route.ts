import { json, handleError, HttpError } from "@/lib/api";
import { currentUser } from "@/lib/auth";
import {
  MONTHLY_DEADLINE_DAY,
  deadlineFor,
  reportingMonthNow,
} from "@/lib/monthly/deadline";

export const runtime = "nodejs";

/**
 * The monthly deadline, for the app and for any outside job that submits
 * reports automatically. Such a job must not submit anything before
 * `autoSubmitNotBefore` (the instant after the last on-time minute).
 *
 * Callable by a signed-in user, or by a job holding CRON_SECRET.
 */
export async function GET(req: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    const bearer = req.headers.get("authorization");
    const isJob = !!secret && bearer === `Bearer ${secret}`;
    if (!isJob && !(await currentUser())) throw new HttpError(401, "Not authenticated");

    const month = reportingMonthNow();
    const deadline = deadlineFor(month);
    return json({
      deadlineDay: MONTHLY_DEADLINE_DAY,
      timezone: "Asia/Kolkata",
      reportingMonth: month,
      deadlineAt: deadline.toISOString(),
      autoSubmitNotBefore: new Date(deadline.getTime() + 1).toISOString(),
    });
  } catch (e) {
    return handleError(e);
  }
}
