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
import { buildRequestFilter, parseRequestQuery, requestFacets } from "@/lib/finance/requests";
import { notifyRoles } from "@/lib/notifications";
import { formatMoney } from "@/lib/money";

const csvCell = (v: unknown) => {
  const t = v == null ? "" : String(v);
  return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** Every request matching the filter, as a spreadsheet-ready CSV (same filter as the list). */
async function exportCsv(filter: Awaited<ReturnType<typeof buildRequestFilter>>) {
  const reqs = await requisitionsCol();
  const total = await reqs.countDocuments(filter);
  if (total > 20000) return json({ error: `${total} requests match — narrow the dates and export in parts.` }, 413);
  const docs = await reqs.find(filter).sort({ createdAt: -1, _id: -1 }).toArray();
  const users = await usersCol();
  const projects = await projectsCol();
  const [uDocs, pDocs] = await Promise.all([
    users.find({ _id: { $in: [...new Set(docs.map((d) => String(d.mobiliserId)))].map((i) => new ObjectId(i)) } }).toArray(),
    projects.find({ _id: { $in: [...new Set(docs.map((d) => String(d.projectId)))].map((i) => new ObjectId(i)) } }).toArray(),
  ]);
  const uName = new Map(uDocs.map((u) => [String(u._id), u.name]));
  const pName = new Map(pDocs.map((p) => [String(p._id), p.name]));
  const head = ["Date", "Type", "Requested by", "Project", "Category", "Purpose", "Amount", "Currency", "Status", "Decision note", "Paid on", "Payment reference"];
  const day = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const lines = docs.map((d) =>
    [
      day(d.createdAt),
      d.kind === "advance" ? "Requisition (advance)" : "Reimbursement",
      uName.get(String(d.mobiliserId)) ?? "",
      pName.get(String(d.projectId)) ?? "",
      d.category,
      d.purpose,
      d.amount,
      d.currency,
      d.status,
      d.reviewNote ?? "",
      day(d.paidAt),
      d.paymentRef ?? "",
    ]
      .map(csvCell)
      .join(",")
  );
  return new Response("\uFEFF" + [head.map(csvCell).join(","), ...lines].join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="requests-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "cm" && user.role !== "director" && user.role !== "accountant") {
      return json({ error: "Forbidden" }, 403);
    }
    const params = new URL(req.url).searchParams;
    const query = parseRequestQuery(params);
    const filter = await buildRequestFilter(user, query);

    if (params.get("format") === "csv") {
      if (user.role === "cm") return json({ error: "Forbidden" }, 403);
      return exportCsv(filter);
    }

    const limit = Math.min(Math.max(Number(params.get("limit")) || 100, 1), 200);
    const page = Math.max(Number(params.get("page")) || 1, 1);

    const reqs = await requisitionsCol();
    const [docs, facets] = await Promise.all([
      reqs
        .find(filter)
        // oldest waiting first when looking at open work, newest first otherwise
        .sort(
          query.status === "pending" || query.status === "approved"
            ? { createdAt: 1, _id: 1 }
            : { createdAt: -1, _id: -1 }
        )
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray(),
      requestFacets(user, query),
    ]);
    const total = facets.matching.count;

    // Enrich with mobiliser + project names + balance (so "can this be paid" is visible).
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
    const pById = new Map(pDocs.map((p) => [String(p._id), p]));

    return json({
      requisitions: docs.map((d) => {
        const p = pById.get(String(d.projectId));
        return {
          ...publicRequisition(d, {
            mobiliserName: uName.get(String(d.mobiliserId)),
            projectName: p?.name,
          }),
          projectBalance: p ? (p.totalFunds || 0) - (p.spentFunds || 0) : null,
        };
      }),
      total,
      page,
      limit,
      pages: Math.max(Math.ceil(total / limit), 1),
      facets,
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

    // Tell the people who approve and pay. References only, no personal details.
    await notifyRoles(
      ["accountant", "director"],
      {
        category: "requisition_submitted",
        title: kind === "advance" ? "New advance requisition" : "New reimbursement claim",
        body: `${user.name} asked for ${formatMoney(amount, doc.currency)} (${doc.category}).`,
        relatedType: "requisition",
        relatedId: String(res.insertedId),
        dedupeKey: `requisition:${res.insertedId}:submitted`,
      },
      { excludeUserId: user._id }
    );
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
