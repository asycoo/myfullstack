import { fail, failZod, ok } from "@/lib/api";
import { verifyAndConsumeCaptcha } from "@/lib/captcha/captcha.service";
import { LoginSchema } from "@/lib/auth/auth.schemas";
import * as authService from "@/lib/auth/auth.service";
import { isRedisConfigured } from "@/lib/redis/client";
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

    if (isRedisConfigured()) {
      const cid = parsed.data.captchaId?.trim();
      const ans = parsed.data.captchaAnswer?.trim();
      if (!cid || ans === undefined || ans === "") {
        return fail("BAD_REQUEST", "请先获取并填写验证码");
      }
      const captchaOk = await verifyAndConsumeCaptcha(cid, ans);
      if (!captchaOk) {
        return fail("BAD_REQUEST", "验证码错误或已过期，请刷新后重试");
      }
    }

    const user = await authService.login(parsed.data);
    return ok(user, { status: 200 });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    safeError("login failed", { route: "/api/auth/login", method: "POST", ip, err: e });
    return fail("INTERNAL_ERROR", "登录失败");
  }
}

