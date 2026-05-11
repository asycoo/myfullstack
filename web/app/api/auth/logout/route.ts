import { ok } from "@/lib/api";
import { getSessionIdFromCookie } from "@/lib/session/session.cookies";
import * as authService from "@/lib/auth/auth.service";
import { requireCsrf } from "@/lib/csrf/csrf.service";

export async function POST(request: Request) {
  await requireCsrf(request);
  const sessionId = await getSessionIdFromCookie();
  const result = await authService.logout(sessionId);
  return ok(result);
}

