import { ObjectId } from "mongodb";
import { json, handleError, requireUser, readJson } from "@/lib/api";
import {
  requisitionsCol,
  usersCol,
  projectsCol,
  ensureIndexes,
  type RequisitionDoc,
} from "@/lib/models";
import { publicRequisition } from "@/lib/serialize";

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const params = new URL(req.url).searchParams;

    const filter: Record<string, unknown> = {};
    if (user.role === "cm") filter.mobiliserId = user._id;
    const status = params.get("status");
    if (status) filter.status = status;

    const reqs = await requisitionsCol();
    const docs = await reqs.find(filter).sort({ createdAt: -1 }).toArray();

    // Enrich with mobiliser + project names.
    const userIds = [...new Set(docs.map((d) => String(d.mobiliserId)))];
    const projIds = [...new Set(docs.map((d) => String(d.projectId)))];
    const users = await usersCol();
    const projects = await projectsCol();
    const [uDocs, pDocs] = await Promise.all([
      userIds.length
        ? users.find({ _id: { $in: userIds.map((i) => new ObjectId(i)) } }).toArray()
        : [],
      projIds.length
        ? projects.find({ _id: { $in: projIds.map((i) => new ObjectId(i)) } }).toArray()
        : [],
    ]);
    const uName = new Map(uDocs.map((u) => [String(u._id), u.name]));
    const pName = new Map(pDocs.map((p) => [String(p._id), p.name]));

    return json({
      requisitions: docs.map((d) =>
        publicRequisition(d, {
          mobiliserName: uName.get(String(d.mobiliserId)),
          projectName: pName.get(String(d.projectId)),
        })
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
      category?: string;
      amount?: number;
      purpose?: string;
      description?: string;
      projectId?: string;
      kind?: string;
      receipts?: { key: string; url: string }[];
    }>(req);

    const kind = body.kind === "advance" ? "advance" : "reimbursement";

    let projectId: ObjectId | undefined = user.projectId;
    if (user.role === "director") {
      if (!body.projectId) return json({ error: "projectId is required" }, 400);
      try {
        projectId = new ObjectId(body.projectId);
      } catch {
        return json({ error: "Invalid projectId" }, 400);
      }
    }
    if (!projectId) {
      return json({ error: "You are not assigned to a project yet" }, 400);
    }

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Enter a valid amount" }, 400);
    }
    if (!body.purpose || !body.purpose.trim()) {
      return json({ error: "Purpose is required" }, 400);
    }

    const projects = await projectsCol();
    const project = await projects.findOne({ _id: projectId });
    if (!project) return json({ error: "Project not found" }, 404);

    const now = new Date();
    const doc: RequisitionDoc = {
      projectId,
      mobiliserId: user._id!,
      kind,
      category: body.category?.trim() || "other",
      amount,
      currency: project.currency || "INR",
      purpose: body.purpose.trim(),
      description: body.description?.trim() || undefined,
      receipts: Array.isArray(body.receipts) ? body.receipts : [],
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };

    const reqs = await requisitionsCol();
    const res = await reqs.insertOne(doc);
    return json(
      {
        requisition: publicRequisition({ ...doc, _id: res.insertedId }, {
          mobiliserName: user.name,
          projectName: project.name,
        }),
      },
      201
    );
  } catch (e) {
    return handleError(e);
  }
}
