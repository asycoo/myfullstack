import { requireUser } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { getClientIp } from "@/lib/ratelimit/ip";
import { rateLimitOrThrow } from "@/lib/ratelimit/ratelimit";
import { safeError } from "@/lib/log/safe-log";
import * as tagsRepo from "@/lib/tags/tags.repo";

export const dynamic = "force-dynamic";

/** 已登录：标签下拉/补全用（按 slug 排序） */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  try {
    await requireUser();
    rateLimitOrThrow({ key: `tags:list:${ip}`, limit: 60, windowMs: 60_000 });
    const items = await tagsRepo.listTagsAlphabetical();
    return ok({ items });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    safeError("list tags failed", { route: "/api/tags", method: "GET", ip, err: e });
    return fail("INTERNAL_ERROR", "获取标签失败");
  }
}
