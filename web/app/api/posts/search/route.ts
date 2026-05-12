import { failZod, ok } from "@/lib/api";
import * as postsService from "@/lib/posts/posts.service";
import { getCurrentUser } from "@/lib/session/session.service";
import { z } from "zod";

const SearchQuerySchema = z.object({
  q: z
    .string()
    .max(200)
    .optional()
    .transform((s) => (s === undefined ? "" : s)),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = SearchQuerySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!parsed.success) return failZod(parsed.error);

  const { q, page, pageSize } = parsed.data;
  const skip = (page - 1) * pageSize;
  const user = await getCurrentUser();
  const { items, total } = user
    ? await postsService.searchPostsForManage(user.id, q, skip, pageSize)
    : await postsService.searchPublishedPostsForPublic(q, skip, pageSize);
  return ok({ items, total });
}
