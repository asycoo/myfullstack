import { fail } from "@/lib/api";
import { excerptFromContent } from "@/lib/posts/excerpt";
import * as repo from "@/lib/posts/posts.repo";
import { SLUG_PATTERN, slugifyTitle } from "@/lib/posts/slug";

export async function listPublishedPostsForPublic(skip: number, take: number) {
  return repo.listPublishedPosts(skip, take);
}

export async function listPostsForDashboard(userId: number, skip: number, take: number) {
  return repo.listPostsVisibleToUser(userId, skip, take);
}

export async function countPublishedPostsForPublic() {
  return repo.countPublishedPosts();
}

const SITEMAP_POST_LIMIT = 5000;

export async function listPublishedSlugsForSitemap() {
  return repo.listPublishedSlugsForSitemap(SITEMAP_POST_LIMIT);
}

export async function countPostsForDashboard(userId: number) {
  return repo.countPostsVisibleToUser(userId);
}

async function allocateUniqueSlug(base: string, excludePostId?: number): Promise<string> {
  let candidate = base;
  for (let i = 0; i < 10_000; i += 1) {
    const taken = await repo.isSlugTakenByOther(candidate, excludePostId);
    if (!taken) return candidate;
    candidate = `${base}-${i + 1}`;
  }
  throw fail("INTERNAL_ERROR", "无法生成唯一 slug");
}

export async function createPost(input: {
  authorId: number;
  title: string;
  content?: string;
  excerpt?: string;
  coverImage?: string;
}) {
  const base = slugifyTitle(input.title);
  const slug = await allocateUniqueSlug(base);
  const excerptTrim = input.excerpt?.trim();
  const excerpt =
    excerptTrim && excerptTrim.length > 0
      ? excerptTrim.slice(0, 500)
      : excerptFromContent(input.content, 200);
  const coverTrim = input.coverImage?.trim();
  return repo.createPost({
    authorId: input.authorId,
    title: input.title,
    content: input.content,
    slug,
    excerpt: excerpt ?? null,
    coverImage: coverTrim && coverTrim.length > 0 ? coverTrim : null,
  });
}

async function assertPostOwnedBy(id: number, userId: number, action: "update" | "delete") {
  const post = await repo.getPostAuthor(id);
  if (!post) throw fail("NOT_FOUND", "文章不存在");
  if (post.authorId !== userId) {
    throw fail("FORBIDDEN", action === "delete" ? "无权限删除他人文章" : "无权限操作他人文章");
  }
}

export async function updatePost(
  id: number,
  userId: number,
  data: {
    title?: string;
    content?: string;
    published?: boolean;
    slug?: string;
    excerpt?: string | null;
    coverImage?: string | null;
  }
) {
  await assertPostOwnedBy(id, userId, "update");

  const next: {
    title?: string;
    content?: string;
    published?: boolean;
    slug?: string;
    excerpt?: string | null;
    coverImage?: string | null;
  } = {};
  if (data.title !== undefined) next.title = data.title;
  if (data.content !== undefined) next.content = data.content;
  if (data.published !== undefined) next.published = data.published;
  if (data.excerpt !== undefined) next.excerpt = data.excerpt;
  if (data.coverImage !== undefined) next.coverImage = data.coverImage;

  if (data.slug !== undefined) {
    const normalized = data.slug.trim().toLowerCase();
    if (!normalized || !SLUG_PATTERN.test(normalized)) {
      throw fail("BAD_REQUEST", "slug 仅允许小写字母、数字与连字符，且不能以连字符开头或结尾");
    }
    if (await repo.isSlugTakenByOther(normalized, id)) {
      throw fail("CONFLICT", "slug 已被使用", { details: { field: "slug" } });
    }
    next.slug = normalized;
  } else if (data.title !== undefined) {
    const base = slugifyTitle(data.title);
    next.slug = await allocateUniqueSlug(base, id);
  }

  if (Object.keys(next).length === 0) {
    const row = await repo.getPostById(id);
    if (!row) throw fail("NOT_FOUND", "文章不存在");
    return row;
  }

  return repo.updatePost(id, next);
}

export async function deletePost(id: number, userId: number) {
  await assertPostOwnedBy(id, userId, "delete");
  await repo.deletePost(id);
  return { ok: true as const };
}

export async function getPublishedPostById(id: number) {
  const post = await repo.getPostById(id);
  if (!post || !post.published) {
    throw fail("NOT_FOUND", "文章不存在");
  }
  return post;
}

export async function getPublishedPostBySlug(slug: string) {
  const post = await repo.findPublishedPostBySlug(slug);
  if (!post) {
    throw fail("NOT_FOUND", "文章不存在");
  }
  return post;
}

/** RSC 用：不抛 Response，便于 `notFound()` */
export async function loadPublishedBySlug(slug: string) {
  return repo.findPublishedPostBySlug(slug);
}

export async function loadPostById(id: number) {
  return repo.getPostById(id);
}
