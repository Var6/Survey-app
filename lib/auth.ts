import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { usersCol, type UserDoc } from "./models";
import { getSession } from "./session";

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/**
 * Resolve the currently logged-in user from the session cookie.
 * Returns null if there is no session, the user is missing, or deactivated.
 */
export async function currentUser(): Promise<UserDoc | null> {
  const session = await getSession();
  if (!session) return null;

  let id: ObjectId;
  try {
    id = new ObjectId(session.sub);
  } catch {
    return null;
  }

  const users = await usersCol();
  const user = await users.findOne({ _id: id });
  if (!user || !user.active) return null;
  return user;
}
