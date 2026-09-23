import type { UserDoc } from "@/lib/models";

/**
 * One filter rule for monthly reports, shared by the on-screen list, the
 * Excel export and the PDF print view — so what you see, what you download
 * and what you print are always the same set of reports.
 *
 * Visibility: the Director and the MIS Supervisor see every report; a
 * Programme Manager sees their own and (with scope=review) the CM and MIS
 * reports they approve; a Community Mobiliser sees only their own.
 */
export function buildMonthlyFilter(
  user: UserDoc,
  params: URLSearchParams
): Record<string, unknown> {
  const filter: Record<string, unknown> = {};

  // The MIS Supervisor reads every report (they own reporting and data
  // quality) but cannot approve any — that guard lives in the review route.
  if (user.role === "cm") {
    filter.programmeManagerId = user._id;
  } else if (user.role === "programme_manager") {
    if (params.get("scope") === "review") {
      filter.authorRole = { $in: ["cm", "mis"] };
    } else {
      filter.programmeManagerId = user._id;
    }
  }

  const authorRole = params.get("authorRole");
  if (authorRole) filter.authorRole = authorRole;

  const status = params.get("status");
  if (status) filter.status = status;

  const month = params.get("month"); // YYYY-MM
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    filter.monthStart = {
      $gte: new Date(Date.UTC(y, m - 1, 1)),
      $lt: new Date(Date.UTC(y, m, 1)),
    };
  }

  return filter;
}
