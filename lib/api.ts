import { currentUser } from "./auth";
import type { UserDoc } from "./models";

/** Error that carries an HTTP status so route handlers can throw + convert. */
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

/** Require any authenticated user or throw 401. */
export async function requireUser(): Promise<UserDoc> {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Not authenticated");
  return user;
}

/** Require a director or throw 401/403. */
export async function requireDirector(): Promise<UserDoc> {
  const user = await requireUser();
  if (user.role !== "director") throw new HttpError(403, "Forbidden");
  return user;
}

/** Require a finance-capable user (director or accountant). */
export async function requireFinance(): Promise<UserDoc> {
  const user = await requireUser();
  if (user.role !== "director" && user.role !== "accountant") {
    throw new HttpError(403, "Forbidden");
  }
  return user;
}

/** Parse and return a JSON body, or throw 400 on malformed input. */
export async function readJson<T = Record<string, unknown>>(
  req: Request
): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
}

/** Convert a thrown value into a JSON error Response. */
export function handleError(e: unknown): Response {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  // Surface a readable message but log full error server-side.
  console.error("[api] unhandled error:", e);
  const message = e instanceof Error ? e.message : "Server error";
  return json({ error: message }, 500);
}
