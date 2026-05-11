import { requireUser } from "@/lib/auth";
import { fail, failZod, ok } from "@/lib/api";
import { z } from "zod";
import * as postsService from "@/lib/posts/posts.service";
import { requireCsrf } from "@/lib/csrf/csrf.service";
import { rateLimitOrThrow } from "@/lib/ratelimit/ratelimit";
import { getClientIp } from "@/lib/ratelimit/ip";
import { safeError } from "@/lib/log/safe-log";
import { Prisma } from "@/app/generated/prisma/client";
import { patchCoverImageZ, patchExcerptZ } from "@/lib/posts/post-fields.zod";
import { SLUG_PATTERN } from "@/lib/posts/slug";

export const dynamic = "force-dynamic";

const IdSchema = z.coerce.number().int().positive();

const UpdatePostSchema = z.object({
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  published: z.boolean().optional(),
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(SLUG_PATTERN)
    .optional(),
  excerpt: patchExcerptZ,
  coverImage: patchCoverImageZ,
});

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(request);
  try {
    await requireCsrf(request);
    const user = await requireUser();
    rateLimitOrThrow({ key: `post:mutate:${user.id}`, limit: 60, windowMs: 60_000 });
    const { id: rawId } = await ctx.params;
    const idParsed = IdSchema.safeParse(rawId);
    if (!idParsed.success) return failZod(idParsed.error);
    const id = idParsed.data;

    const bodyParsed = UpdatePostSchema.safeParse(await request.json());
    if (!bodyParsed.success) return failZod(bodyParsed.error);

    const updated = await postsService.updatePost(id, user.id, bodyParsed.data);

    return ok(updated);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("CONFLICT", "slug 冲突", { details: { field: "slug" } });
    }
    safeError("update post failed", { route: "/api/posts/[id]", method: "PATCH", ip, err: e });
    return fail("INTERNAL_ERROR", "更新文章失败");
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const ip = getClientIp(request);
  try {
    await requireCsrf(request);
    const user = await requireUser();
    rateLimitOrThrow({ key: `post:mutate:${user.id}`, limit: 60, windowMs: 60_000 });
    const { id: rawId } = await ctx.params;
    const idParsed = IdSchema.safeParse(rawId);
    if (!idParsed.success) return failZod(idParsed.error);
    const id = idParsed.data;

    const result = await postsService.deletePost(id, user.id);
    return ok(result);
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    safeError("delete post failed", { route: "/api/posts/[id]", method: "DELETE", ip, err: e });
    return fail("INTERNAL_ERROR", "删除文章失败");
  }
}
