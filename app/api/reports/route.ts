import { ObjectId } from "mongodb";
import { json, handleError, requireUser, readJson } from "@/lib/api";
import {
  reportsCol,
  usersCol,
  ensureIndexes,
  type ReportDoc,
  type ReportPeriod,
} from "@/lib/models";
import { publicReport } from "@/lib/serialize";

const PERIODS: ReportPeriod[] = ["daily", "weekly", "monthly"];

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const params = new URL(req.url).searchParams;

    const filter: Record<string, unknown> = {};
    if (user.role === "cm" || params.get("mine") === "1") {
      filter.mobiliserId = user._id;
    } else {
      const mob = params.get("mobiliserId");
      if (mob) {
        try {
          filter.mobiliserId = new ObjectId(mob);
        } catch {
          /* ignore */
        }
      }
    }
    const period = params.get("period");
    if (period && PERIODS.includes(period as ReportPeriod)) filter.period = period;
    // Author-role filter: legacy reports (no authorRole) are all CM reports.
    const role = params.get("role");
    if (role === "cm") {
      filter.$or = [{ authorRole: "cm" }, { authorRole: { $exists: false } }];
    } else if (role === "pm") {
      filter.authorRole = "programme_manager";
    }

    const reports = await reportsCol();
    const docs = await reports.find(filter).sort({ periodDate: -1 }).toArray();

    const ids = [...new Set(docs.map((d) => String(d.mobiliserId)))];
    const users = await usersCol();
    const uDocs = ids.length
      ? await users.find({ _id: { $in: ids.map((i) => new ObjectId(i)) } }).toArray()
      : [];
    const uName = new Map(uDocs.map((u) => [String(u._id), u.name]));

    return json({
      reports: docs.map((d) =>
        publicReport(d, { mobiliserName: uName.get(String(d.mobiliserId)) })
      ),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    await ensureIndexes();
    const body = await readJson<{
      period?: string;
      periodDate?: string;
      metrics?: Record<string, unknown>;
      data?: Record<string, unknown>;
      notes?: string;
    }>(req);

    if (!body.period || !PERIODS.includes(body.period as ReportPeriod)) {
      return json({ error: "period must be daily, weekly or monthly" }, 400);
    }

    const metrics: Record<string, number> = {};
    if (body.metrics && typeof body.metrics === "object") {
      for (const [k, v] of Object.entries(body.metrics)) {
        const n = Number(v);
        if (Number.isFinite(n)) metrics[k] = n;
      }
    }

    const now = new Date();
    const doc: ReportDoc = {
      projectId: user.projectId,
      mobiliserId: user._id!,
      authorRole: user.role,
      period: body.period as ReportPeriod,
      periodDate: body.periodDate ? new Date(body.periodDate) : now,
      metrics,
      data:
        body.data && typeof body.data === "object" ? body.data : undefined,
      notes: body.notes?.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const reports = await reportsCol();
    const res = await reports.insertOne(doc);
    return json(
      { report: publicReport({ ...doc, _id: res.insertedId }, { mobiliserName: user.name }) },
      201
    );
  } catch (e) {
    return handleError(e);
  }
}
