/**
 * Where a notification opens, for the viewer's area ("/cm", "/pm", "/mis",
 * "/director"). Notifications store what they are about (type + id); the link
 * is built per role because each role has its own pages.
 */
export const NOTIFICATION_LABEL: Record<string, string> = {
  case_opened: "Case opened",
  followup_completed: "Follow-up completed",
  closure_requested: "Closure requested",
  closure_approved: "Closure approved",
  closure_rejected: "Closure rejected",
  camp_created: "Camp created",
  camp_updated: "Camp updated",
  meeting_created: "Meeting created",
  meeting_updated: "Meeting updated",
  meeting_invited: "Meeting invitation",
  report_reminder: "Report reminder",
};

export function notificationHref(
  area: string,
  n: { relatedType: string | null; relatedId: string | null }
): string | null {
  if (!n.relatedType) return null;
  const id = n.relatedId ? encodeURIComponent(n.relatedId) : "";
  switch (n.relatedType) {
    case "case":
      return area === "/cm"
        ? `/cm/cases/${id}`
        : `${area}/cases/all?open=${id}&status=all`;
    case "camp":
      return `${area}/camps?open=${id}`;
    case "meeting":
      return `${area}/meetings?open=${id}`;
    case "monthly":
      return area === "/director" ? "/director/reports" : `${area}/monthly`;
    default:
      return null;
  }
}
