import type { MetadataRoute } from "next";

import * as postsService from "@/lib/posts/posts.service";
import { getSiteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const origin = getSiteUrl().origin;
  const posts = await postsService.listPublishedSlugsForSitemap();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${origin}/`, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    { url: `${origin}/posts`, lastModified: new Date(), changeFrequency: "daily", priority: 0.9 },
  ];

  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${origin}/posts/${encodeURIComponent(p.slug)}`,
    lastModified: p.updatedAt,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticEntries, ...postEntries];
}
