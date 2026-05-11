import { fail, ok } from "@/lib/api";
import * as postsService from "@/lib/posts/posts.service";
import { safeError } from "@/lib/log/safe-log";
import { SLUG_PATTERN } from "@/lib/posts/slug";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug: raw } = await ctx.params;
    let slug: string;
    try {
      slug = decodeURIComponent(raw).trim().toLowerCase();
    } catch {
      return fail("BAD_REQUEST", "slug 无效");
    }
    if (!slug || slug.length > 200 || !SLUG_PATTERN.test(slug)) {
      return fail("BAD_REQUEST", "slug 格式无效");
    }

    const post = await postsService.getPublishedPostBySlug(slug);
    return ok(post);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    safeError("get published post by slug failed", { route: "/api/posts/slug/[slug]", method: "GET", err: e });
    return fail("INTERNAL_ERROR", "获取文章失败");
  }
}
