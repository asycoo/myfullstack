import { requireUser } from "@/lib/auth";
import { fail, failZod, ok } from "@/lib/api";
import { z } from "zod";
import * as postsService from "@/lib/posts/posts.service";
import { requireCsrf } from "@/lib/csrf/csrf.service";
import { rateLimitOrThrow } from "@/lib/ratelimit/ratelimit";
import { getClientIp } from "@/lib/ratelimit/ip";
import { safeError } from "@/lib/log/safe-log";

const CreatePostSchema = z.object({
  title: z.string().min(1),
  content: z.string().optional(),
});

export async function GET() {
  const posts = await postsService.listPosts();

  return ok(posts);
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  try {
    await requireCsrf(request);
    const user = await requireUser();
    rateLimitOrThrow({ key: `post:create:${user.id}`, limit: 30, windowMs: 60_000 });
    const parsed = CreatePostSchema.safeParse(await request.json());
    if (!parsed.success) return failZod(parsed.error);
    const { title, content } = parsed.data;

    const post = await postsService.createPost({ authorId: user.id, title, content });

    return ok(post, { status: 201 });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    safeError("create post failed", { route: "/api/posts", method: "POST", ip, err: e });
    return fail("INTERNAL_ERROR", "创建文章失败");
  }
}