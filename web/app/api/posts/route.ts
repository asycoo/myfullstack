import { requireUser } from "@/lib/auth";
import { fail, failZod, ok } from "@/lib/api";
import { z } from "zod";
import * as postsService from "@/lib/posts/posts.service";
import { requireCsrf } from "@/lib/csrf/csrf.service";
import { rateLimitOrThrow } from "@/lib/ratelimit/ratelimit";
import { getClientIp } from "@/lib/ratelimit/ip";
import { safeError } from "@/lib/log/safe-log";
import { getCurrentUser } from "@/lib/session/session.service";
import { Prisma } from "@/app/generated/prisma/client";
import { optionalCoverImageZ, optionalExcerptZ } from "@/lib/posts/post-fields.zod";

const CreatePostSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
  excerpt: optionalExcerptZ,
  coverImage: optionalCoverImageZ,
});

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(100),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return failZod(parsed.error);

  const { page, pageSize } = parsed.data;
  const skip = (page - 1) * pageSize;

  const user = await getCurrentUser();
  if (user) {
    const [items, total] = await Promise.all([
      postsService.listPostsForDashboard(user.id, skip, pageSize),
      postsService.countPostsForDashboard(user.id),
    ]);
    return ok({ items, total });
  }

  const [items, total] = await Promise.all([
    postsService.listPublishedPostsForPublic(skip, pageSize),
    postsService.countPublishedPostsForPublic(),
  ]);
  return ok({ items, total });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  try {
    await requireCsrf(request);
    const user = await requireUser();
    rateLimitOrThrow({ key: `post:create:${user.id}`, limit: 30, windowMs: 60_000 });
    const parsed = CreatePostSchema.safeParse(await request.json());
    if (!parsed.success) return failZod(parsed.error);
    const { title, content, excerpt, coverImage } = parsed.data;

    const post = await postsService.createPost({ authorId: user.id, title, content, excerpt, coverImage });

    return ok(post, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return fail("CONFLICT", "slug 冲突", { details: { field: "slug" } });
    }
    safeError("create post failed", { route: "/api/posts", method: "POST", ip, err: e });
    return fail("INTERNAL_ERROR", "创建文章失败");
  }
}