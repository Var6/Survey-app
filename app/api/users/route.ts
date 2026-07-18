import { ObjectId } from "mongodb";
import {
  json,
  handleError,
  requireDirector,
  requireFinance,
  readJson,
} from "@/lib/api";
import { usersCol, ensureIndexes, type UserDoc, type Role } from "@/lib/models";
import { hashPassword } from "@/lib/auth";
import { publicUser } from "@/lib/serialize";

const ROLES: Role[] = [
  "director",
  "accountant",
  "cm",
  "programme_manager",
  "mis",
];

export async function GET(req: Request) {
  try {
    // Finance users (director/accountant) can list users (e.g. for payroll).
    await requireFinance();
    const url = new URL(req.url);
    const role = url.searchParams.get("role");
    const projectId = url.searchParams.get("projectId");

    const filter: Record<string, unknown> = {};
    if (role && ROLES.includes(role as Role)) filter.role = role;
    if (projectId) {
      try {
        filter.projectId = new ObjectId(projectId);
      } catch {
        /* ignore */
      }
    }

    const users = await usersCol();
    const list = await users.find(filter).sort({ createdAt: -1 }).toArray();
    return json({ users: list.map(publicUser) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: Request) {
  try {
    // Only a director can create/manage user accounts.
    const director = await requireDirector();
    await ensureIndexes();
    const body = await readJson<{
      role?: Role;
      name?: string;
      email?: string;
      password?: string;
      phone?: string;
      mobiliserCode?: string;
      projectId?: string;
      communities?: string[];
    }>(req);

    const role: Role = ROLES.includes(body.role as Role) ? (body.role as Role) : "cm";
    const name = body.name?.trim();
    const email = body.email?.toLowerCase().trim();
    const password = body.password;

    if (!name || !email || !password) {
      return json({ error: "Name, email and password are required" }, 400);
    }
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    const users = await usersCol();
    if (await users.findOne({ email })) {
      return json({ error: "A user with this email already exists" }, 409);
    }

    let projectId: ObjectId | undefined;
    if (role === "cm" && body.projectId) {
      try {
        projectId = new ObjectId(body.projectId);
      } catch {
        return json({ error: "Invalid projectId" }, 400);
      }
    }

    const now = new Date();
    const doc: UserDoc = {
      role,
      name,
      email,
      passwordHash: await hashPassword(password),
      phone: body.phone?.trim() || undefined,
      // CM-only fields
      mobiliserCode: role === "cm" ? body.mobiliserCode?.trim() || undefined : undefined,
      projectId,
      communities: role === "cm" && Array.isArray(body.communities) ? body.communities : [],
      active: true,
      createdBy: director._id,
      createdAt: now,
      updatedAt: now,
    };

    const res = await users.insertOne(doc);
    return json({ user: publicUser({ ...doc, _id: res.insertedId }) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
