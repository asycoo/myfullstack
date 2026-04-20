import { fail, failZod, ok } from "@/lib/api";
import { RegisterSchema } from "@/lib/auth/auth.schemas";
import * as authService from "@/lib/auth/auth.service";
import { requireAllowedOrigin } from "@/lib/security/origin";
import { getClientIp } from "@/lib/ratelimit/ip";
import { rateLimitOrThrow } from "@/lib/ratelimit/ratelimit";
import { safeError } from "@/lib/log/safe-log";

export async function POST(request: Request) {
  try {
    requireAllowedOrigin(request);
    const ip = getClientIp(request);
    rateLimitOrThrow({ key: `register:${ip}`, limit: 3, windowMs: 60_000 });
    const parsed = RegisterSchema.safeParse(await request.json());
    if (!parsed.success) return failZod(parsed.error);
    const user = await authService.register(parsed.data);
    return ok(user, { status: 201 });
  } catch (e: unknown) {
    // 兜底：即使并发下绕过了 findUnique，也尽量把“邮箱重复”稳定映射成 409
    if (typeof e === "object" && e && "code" in e && (e as { code?: unknown }).code === "P2002") {
      return fail("CONFLICT", "该邮箱已被注册");
    }
    if (e instanceof Response) return e;
    safeError("register failed", { err: e });
    return fail("INTERNAL_ERROR", "注册失败");
  }
}

