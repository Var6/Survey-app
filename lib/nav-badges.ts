import { casesCol } from "./models";

/** Closure requests waiting for a reviewer — shown as a badge in the sidebar. */
export async function pendingClosureCount(): Promise<number> {
  try {
    const col = await casesCol();
    return await col.countDocuments({
      closed: false,
      workflowStatus: { $in: ["closure_requested", "under_review"] },
    });
  } catch {
    return 0;
  }
}
