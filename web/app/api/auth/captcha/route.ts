import { fail, ok } from "@/lib/api";
import * as captchaService from "@/lib/captcha/captcha.service";
import { isRedisConfigured, redisPing } from "@/lib/redis/client";
import { requireAllowedOrigin } from "@/lib/security/origin";
import { getClientIp } from "@/lib/ratelimit/ip";
import { rateLimitOrThrow } from "@/lib/ratelimit/ratelimit";
import { safeError } from "@/lib/log/safe-log";

export const dynamic = "force-dynamic";

/** 获取登录用算术验证码（Redis TTL）；未配置 REDIS_URL 时返回 disabled，登录可不传验证码 */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  try {
    requireAllowedOrigin(request);

    if (!isRedisConfigured()) {
      return ok({ disabled: true as const });
    }

    rateLimitOrThrow({
      key: `captcha:get:${ip}`,
      limit: 40,
      windowMs: 60_000,
    });

    const alive = await redisPing();
    if (!alive) {
      return fail("SERVICE_UNAVAILABLE", "验证码服务暂不可用，请确认 Redis 已启动", { status: 503 });
    }

    const challenge = await captchaService.createMathCaptcha();
    return ok({ disabled: false as const, ...challenge });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    safeError("captcha get failed", { route: "/api/auth/captcha", method: "GET", ip, err: e });
    return fail("INTERNAL_ERROR", "获取验证码失败");
  }
}
