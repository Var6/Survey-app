import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./models";

/**
 * Pure token utilities (no `next/headers`) so this module is safe to import
 * from `proxy.ts` (edge runtime) as well as from route handlers.
 */

export const SESSION_COOKIE = "janman_session";

export interface SessionPayload {
  sub: string; // user _id
  role: Role;
  name: string;
  email: string;
  projectId?: string;
}

function secretKey(): Uint8Array {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    throw new Error(
      "AUTH_SECRET is not set. Add it to .env.local (openssl rand -base64 48)."
    );
  }
  return new TextEncoder().encode(s);
}

export function sessionMaxAge(): number {
  return Number(process.env.SESSION_MAX_AGE || 604800);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + sessionMaxAge())
    .sign(secretKey());
}

/** Verify a raw token string. Returns null if invalid/expired/misconfigured. */
export async function verifySessionToken(
  token: string
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), {
      algorithms: ["HS256"],
    });
    return {
      sub: String(payload.sub),
      role: payload.role as Role,
      name: String(payload.name),
      email: String(payload.email),
      projectId: payload.projectId ? String(payload.projectId) : undefined,
    };
  } catch {
    return null;
  }
}
