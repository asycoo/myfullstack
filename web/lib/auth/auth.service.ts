import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/api";
import { clearSessionCookie, getSessionIdFromCookie, setSessionCookie } from "@/lib/session/session.cookies";
import * as authRepo from "@/lib/auth/auth.repo";
import * as sessionRepo from "@/lib/session/session.repo";
import { createSessionForUser } from "@/lib/session/session.service";
import type { LoginInput, RegisterInput } from "@/lib/auth/auth.schemas";

export async function register(input: RegisterInput) {
  const exists = await authRepo.userExistsByEmail(input.email);
  if (exists) throw fail("CONFLICT", "该邮箱已被注册");

  const hashed = await bcrypt.hash(input.password, 10);

  // 事务：User + Session 一起成功/失败
  const sessionId = randomBytes(32).toString("hex");
  const csrfToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const user = await prisma.$transaction(
    async (tx) => {
      const created = await tx.user.create({
        data: { email: input.email, password: hashed, name: input.name },
        select: { id: true, email: true, name: true },
      });
      await tx.session.create({
        data: { id: sessionId, userId: created.id, expiresAt, csrfToken },
      });
      return created;
    },
    {
      // 本地/冷启动时 Prisma 默认 5s 事务超时可能过紧，注册链路又包含两次写入
      maxWait: 10_000,
      timeout: 30_000,
    },
  );

  await setSessionCookie(sessionId, expiresAt);
  return user;
}

export async function login(input: LoginInput) {
  const user = await authRepo.findUserForLogin(input.email);
  if (!user) throw fail("UNAUTHORIZED", "邮箱或密码错误");

  const passwordOk = await bcrypt.compare(input.password, user.password);
  if (!passwordOk) throw fail("UNAUTHORIZED", "邮箱或密码错误");

  // 复用“当前设备”的 session：如果 cookie 里已有该用户的有效 session，则只刷新 expiresAt/csrfToken
  const now = new Date();
  const existingSessionId = await getSessionIdFromCookie();
  if (existingSessionId) {
    const existing = await sessionRepo.findValidSession(existingSessionId, now);
    if (existing?.userId === user.id) {
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      const csrfToken = randomBytes(32).toString("hex");
      await sessionRepo.updateSessionById(existingSessionId, { expiresAt, csrfToken });
      await setSessionCookie(existingSessionId, expiresAt);
      return { id: user.id, email: user.email, name: user.name };
    }

    // 如果 cookie 里的 session 属于别的用户，避免 session fixation：清掉这条 session
    await sessionRepo.deleteSessionById(existingSessionId);
  }

  const session = await createSessionForUser(user.id);
  await setSessionCookie(session.id, session.expiresAt);

  return { id: user.id, email: user.email, name: user.name };
}

export async function logout(sessionId: string | null) {
  if (sessionId) {
    await sessionRepo.deleteSessionById(sessionId);
  }
  await clearSessionCookie();
  return { ok: true as const };
}

