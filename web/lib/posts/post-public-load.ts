import type { PostWithAuthor } from "@/lib/posts/posts.repo";
import * as postsService from "@/lib/posts/posts.service";

/** 与 `[slug]/page`、OG 图路由一致：解码动态段 */
export function decodePostSlugSegment(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return "";
  }
}

/** 公开访问用：数字 id 或 slug，仅已发布 */
export async function loadPublishedPostForPublicPage(rawSlugParam: string): Promise<PostWithAuthor | null> {
  const raw = decodePostSlugSegment(rawSlugParam);
  if (!raw) return null;
  if (/^\d+$/.test(raw)) {
    const row = await postsService.loadPostById(Number(raw));
    return row?.published ? row : null;
  }
  return postsService.loadPublishedBySlug(raw.toLowerCase());
}
