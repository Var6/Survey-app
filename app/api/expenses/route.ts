import { ObjectId } from "mongodb";
import { json, handleError, requireFinance, readJson } from "@/lib/api";
import {
  expensesCol,
  projectsCol,
  ledgerCol,
  ensureIndexes,
  type ExpenseDoc,
} from "@/lib/models";
import { publicExpense } from "@/lib/serialize";

export async function GET(req: Request) {
  try {
    await requireFinance();
    const params = new URL(req.url).searchParams;
    const filter: Record<string, unknown> = {};
    const pid = params.get("projectId");
    if (pid) {
      try {
        filter.projectId = new ObjectId(pid);
      } catch {
        /* ignore */
      }
    }

    const expenses = await expensesCol();
    const docs = await expenses.find(filter).sort({ date: -1 }).toArray();

    const projects = await projectsCol();
    const pIds = [...new Set(docs.map((d) => String(d.projectId)))];
    const pDocs = pIds.length
      ? await projects.find({ _id: { $in: pIds.map((i) => new ObjectId(i)) } }).toArray()
      : [];
    const pName = new Map(pDocs.map((p) => [String(p._id), p.name]));

    return json({
      expenses: docs.map((d) =>
        publicExpense(d, { projectName: pName.get(String(d.projectId)) })
      ),
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    const director = await requireFinance();
    await ensureIndexes();
    const body = await readJson<{
      projectId?: string;
      category?: string;
      amount?: number;
      description?: string;
      paidTo?: string;
      date?: string;
      receipts?: { key: string; url: string }[];
    }>(req);

    const projects = await projectsCol();
    let projectId: ObjectId | null = null;
    if (body.projectId) {
      try {
        projectId = new ObjectId(body.projectId);
      } catch {
        return json({ error: "Invalid projectId" }, 400);
      }
    } else {
      const first = await projects.findOne({}, { sort: { createdAt: 1 } });
      projectId = first?._id ?? null;
    }
    if (!projectId) {
      return json({ error: "Create a project first" }, 400);
    }
    const project = await projects.findOne({ _id: projectId });
    if (!project) return json({ error: "Project not found" }, 404);

    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return json({ error: "Enter a valid amount" }, 400);
    }

    const now = new Date();
    const doc: ExpenseDoc = {
      projectId,
      category: body.category?.trim() || "other",
      amount,
      currency: project.currency || "INR",
      description: body.description?.trim() || undefined,
      paidTo: body.paidTo?.trim() || undefined,
      date: body.date ? new Date(body.date) : now,
      receipts: Array.isArray(body.receipts) ? body.receipts : [],
      createdBy: director._id,
      createdByName: director.name,
      createdAt: now,
      updatedAt: now,
    };

    const expenses = await expensesCol();
    const res = await expenses.insertOne(doc);

    // Debit the project + write a ledger entry.
    const newSpent = (project.spentFunds || 0) + amount;
    await projects.updateOne(
      { _id: projectId },
      { $inc: { spentFunds: amount }, $set: { updatedAt: now } }
    );
    const ledger = await ledgerCol();
    await ledger.insertOne({
      projectId,
      type: "debit",
      amount,
      refType: "expense",
      refId: res.insertedId,
      balanceAfter: (project.totalFunds || 0) - newSpent,
      note: `Expense: ${doc.category}${doc.description ? " — " + doc.description : ""}`,
      createdBy: director._id,
      createdAt: now,
    });

    return json(
      { expense: publicExpense({ ...doc, _id: res.insertedId }, { projectName: project.name }) },
      201
    );
  } catch (e) {
    return handleError(e);
  }
}
