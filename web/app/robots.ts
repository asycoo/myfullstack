import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/site-url";

/** 默认允许整站抓取；API 与后台管理路径不索引，避免浪费爬虫配额 */
export default function robots(): MetadataRoute.Robots {
  const origin = getSiteUrl().origin;
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/posts/manage"],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
