import { getSiteUrl } from "@/lib/site-url";
import * as postsService from "@/lib/posts/posts.service";
import { buildPostsRssXml } from "@/lib/rss/build-rss";

export const dynamic = "force-dynamic";

const RSS_LIMIT = 30;

export async function GET() {
  const origin = getSiteUrl().origin;
  const posts = await postsService.listPublishedPostsForPublic(0, RSS_LIMIT);
  const xml = buildPostsRssXml(origin, posts);
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
