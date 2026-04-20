import { fail } from "@/lib/api";
import { getSessionIdFromCookie } from "@/lib/session/session.cookies";
import * as sessionRepo from "@/lib/session/session.repo";

const CSRF_HEADER_NAME = "x-csrf-token";

export async function getCsrfTokenForCurrentSession(): Promise<{ token: string }> {
  const sessionId = await getSessionIdFromCookie();
  if (!sessionId) {
    throw fail("UNAUTHORIZED", "未登录");
  }

  const session = await sessionRepo.findValidSession(sessionId, new Date());
  if (!session) {
    throw fail("UNAUTHORIZED", "未登录");
  }

  const token = session.csrfToken ?? null;
  if (!token) {
    // 兼容历史 session：没有 csrfToken 的旧 session 一律要求重新登录
    throw fail("UNAUTHORIZED", "未登录");
  }

  return { token };
}

export async function requireCsrf(request: Request): Promise<void> {
  const sessionId = await getSessionIdFromCookie();
  if (!sessionId) throw fail("UNAUTHORIZED", "未登录");

  const session = await sessionRepo.findValidSession(sessionId, new Date());
  if (!session) throw fail("UNAUTHORIZED", "未登录");

  const sessionToken = session.csrfToken ?? null;
  if (!sessionToken) throw fail("FORBIDDEN", "CSRF 校验失败");

  const headerToken = request.headers.get(CSRF_HEADER_NAME);
  if (!headerToken) throw fail("FORBIDDEN", "CSRF 校验失败");

  if (headerToken !== sessionToken) throw fail("FORBIDDEN", "CSRF 校验失败");
}

