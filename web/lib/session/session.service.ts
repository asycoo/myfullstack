import { randomBytes } from "node:crypto";
import { fail } from "@/lib/api";
import * as repo from "@/lib/session/session.repo";
import { getSessionIdFromCookie } from "@/lib/session/session.cookies";

export type SafeUser = {
  id: number;
  email: string;
  name: string | null;
};

const SESSION_TTL_DAYS = 30;

export async function createSessionForUser(userId: number) {
  const id = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await repo.createSession({ id, userId, expiresAt, csrfToken });
  return { id, expiresAt };
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  const sessionId = await getSessionIdFromCookie();
  if (!sessionId) return null;

  const session = await repo.findValidSessionWithUser(sessionId, new Date());
  return session?.user ?? null;
}

export async function requireUser(): Promise<SafeUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw fail("UNAUTHORIZED", "未登录");
  }
  return user;
}

