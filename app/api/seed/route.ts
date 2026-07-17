import { readJson, json, handleError } from "@/lib/api";
import { usersCol, ensureIndexes, type UserDoc } from "@/lib/models";
import { hashPassword } from "@/lib/auth";
import { publicUser } from "@/lib/serialize";

/**
 * One-time bootstrap: create the first Director account.
 * Protected by SEED_SECRET (header `x-seed-secret` or body `secret`).
 * Set SEED_SECRET, call once, then clear it.
 */
export async function POST(req: Request) {
  try {
    const secret = process.env.SEED_SECRET;
    if (!secret) {
      return json({ error: "SEED_SECRET is not set in .env.local" }, 400);
    }

    const body = await readJson<{
      secret?: string;
      email?: string;
      password?: string;
      name?: string;
    }>(req);

    const provided = req.headers.get("x-seed-secret") || body.secret;
    if (provided !== secret) {
      return json({ error: "Forbidden" }, 403);
    }

    await ensureIndexes();
    const users = await usersCol();

    const email = (body.email || process.env.SEED_DIRECTOR_EMAIL || "")
      .toLowerCase()
      .trim();
    const password = body.password || process.env.SEED_DIRECTOR_PASSWORD;
    const name = body.name || process.env.SEED_DIRECTOR_NAME || "Director";

    if (!email || !password) {
      return json(
        { error: "email and password are required (in body or SEED_DIRECTOR_* env)" },
        400
      );
    }

    const existing = await users.findOne({ email });
    if (existing) {
      return json({ error: "A user with this email already exists" }, 409);
    }

    const now = new Date();
    const doc: UserDoc = {
      role: "director",
      name,
      email,
      passwordHash: await hashPassword(password),
      active: true,
      createdAt: now,
      updatedAt: now,
    };
    const res = await users.insertOne(doc);

    return json({ ok: true, user: publicUser({ ...doc, _id: res.insertedId }) });
  } catch (e) {
    return handleError(e);
  }
}
