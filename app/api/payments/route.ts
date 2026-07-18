import { ObjectId } from "mongodb";
import { json, handleError, requireUser, requireDirector, readJson } from "@/lib/api";
import {
  paymentsCol,
  usersCol,
  projectsCol,
  ensureIndexes,
  type PaymentDoc,
  type PaymentType,
} from "@/lib/models";
import { publicPayment } from "@/lib/serialize";
import { settlePayment } from "@/lib/pay";

const TYPES: PaymentType[] = ["salary", "benefit", "bonus", "other"];

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const params = new URL(req.url).searchParams;

    const filter: Record<string, unknown> = {};
    if (user.role === "cm") {
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
      const status = params.get("status");
      if (status) filter.status = status;
      const type = params.get("type");
      if (type) filter.type = type;
    }

    const payments = await paymentsCol();
    const docs = await payments.find(filter).sort({ createdAt: -1 }).toArray();

    // Enrich with project name.
    const projects = await projectsCol();
    const pIds = [...new Set(docs.map((d) => String(d.projectId)))];
    const pDocs = pIds.length
      ? await projects.find({ _id: { $in: pIds.map((i) => new ObjectId(i)) } }).toArray()
      : [];
    const pName = new Map(pDocs.map((p) => [String(p._id), p.name]));

    return json({
      payments: docs.map((d) =>
        publicPayment(d, { projectName: pName.get(String(d.projectId)) })
      ),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const director = await requireDirector();
    await ensureIndexes();
    const body = await readJson<{
      mobiliserId?: string;
      type?: PaymentType;
      amount?: number;
      period?: string;
      note?: string;
      projectId?: string;
      payNow?: boolean;
    }>(req);

    if (!body.mobiliserId) return json({ error: "Select a mobiliser" }, 400);
    let mobiliserId: ObjectId;
    try {
      mobiliserId = new ObjectId(body.mobiliserId);
    } catch {
      return json({ error: "Invalid mobiliserId" }, 400);
    }

    const type: PaymentType = TYPES.includes(body.type as PaymentType)
      ? (body.type as PaymentType)
      : "salary";
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Enter a valid amount" }, 400);
    }

    const users = await usersCol();
    const cm = await users.findOne({ _id: mobiliserId, role: "cm" });
    if (!cm) return json({ error: "Mobiliser not found" }, 404);

    // Resolve project: explicit → CM's project → first project.
    const projects = await projectsCol();
    let projectId: ObjectId | null = null;
    if (body.projectId) {
      try {
        projectId = new ObjectId(body.projectId);
      } catch {
        return json({ error: "Invalid projectId" }, 400);
      }
    } else if (cm.projectId) {
      projectId = cm.projectId;
    } else {
      const first = await projects.findOne({}, { sort: { createdAt: 1 } });
      projectId = first?._id ?? null;
    }
    if (!projectId) return json({ error: "Create a project first" }, 400);
    const project = await projects.findOne({ _id: projectId });
    if (!project) return json({ error: "Project not found" }, 404);

    const now = new Date();
    const doc: PaymentDoc = {
      projectId,
      mobiliserId,
      mobiliserName: cm.name,
      type,
      amount,
      currency: project.currency || "INR",
      period: body.period?.trim() || undefined,
      note: body.note?.trim() || undefined,
      status: "pending",
      createdBy: director._id,
      createdByName: director.name,
      createdAt: now,
      updatedAt: now,
    };

    const payments = await paymentsCol();
    const res = await payments.insertOne(doc);

    if (body.payNow) {
      const result = await settlePayment(res.insertedId, director);
      if (!result.ok) {
        // Keep the pending record but report why it wasn't paid.
        const created = await payments.findOne({ _id: res.insertedId });
        return json({ payment: publicPayment(created!), warning: result.error }, 201);
      }
    }

    const created = await payments.findOne({ _id: res.insertedId });
    return json(
      { payment: publicPayment(created!, { projectName: project.name }) },
      201
    );
  } catch (e) {
    return handleError(e);
  }
}
