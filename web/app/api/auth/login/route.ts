import { fail, failZod, ok } from "@/lib/api";
import { LoginSchema } from "@/lib/auth/auth.schemas";
import * as authService from "@/lib/auth/auth.service";
import { requireAllowedOrigin } from "@/lib/security/origin";
import { getClientIp } from "@/lib/ratelimit/ip";
import { rateLimitOrThrow } from "@/lib/ratelimit/ratelimit";
import { safeError } from "@/lib/log/safe-log";

export async function POST(request: Request) {
  const ip = getClientIp(request);
  try {
    requireAllowedOrigin(request);
    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) return failZod(parsed.error);

    rateLimitOrThrow({
      key: `login:${ip}:${parsed.data.email}`,
      limit: 5,
      windowMs: 60_000,
    });

    const user = await authService.login(parsed.data);
    return ok(user, { status: 200 });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    safeError("login failed", { route: "/api/auth/login", method: "POST", ip, err: e });
    return fail("INTERNAL_ERROR", "登录失败");
  }
}

