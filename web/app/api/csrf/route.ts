import { ok, fail } from "@/lib/api";
import { getCsrfTokenForCurrentSession } from "@/lib/csrf/csrf.service";
import { safeError } from "@/lib/log/safe-log";

export async function GET() {
  try {
    const { token } = await getCsrfTokenForCurrentSession();
    return ok({ token });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    safeError("get csrf token failed", { route: "/api/csrf", method: "GET", err: e });
    return fail("INTERNAL_ERROR", "获取 CSRF Token 失败");
  }
}

