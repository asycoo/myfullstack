import { excerptFromContent } from "@/lib/posts/excerpt";

/** XML 1.0 文本节点非法控制字符 */
function stripIllegalXmlChars(s: string): string {
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** 元素文本转义，避免 RSS 解析器与注入问题 */
export function escapeXml(s: string): string {
  return stripIllegalXmlChars(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type RssPost = {
  title: string;
  slug: string;
  content: string | null;
  excerpt: string | null;
  createdAt: Date;
  author: { name: string | null; email: string };
};

function itemDescription(p: RssPost): string {
  const ex = p.excerpt?.trim();
  if (ex) return ex;
  return excerptFromContent(p.content ?? undefined, 500) ?? p.title;
}

function authorLine(p: RssPost): string {
  const name = p.author.name?.trim();
  const email = p.author.email;
  if (name) return `${escapeXml(email)} (${escapeXml(name)})`;
  return escapeXml(email);
}

export function buildPostsRssXml(origin: string, posts: RssPost[]): string {
  const siteTitle = "全栈练习";
  const siteDesc = "Next.js + Prisma 练习博客";
  const selfLink = `${origin}/rss.xml`;

  const items = posts
    .map((p) => {
      const link = `${origin}/posts/${encodeURIComponent(p.slug)}`;
      const desc = escapeXml(itemDescription(p));
      const pub = new Date(p.createdAt).toUTCString();
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${escapeXml(pub)}</pubDate>
      <author>${authorLine(p)}</author>
      <description>${desc}</description>
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(siteTitle)}</title>
    <link>${escapeXml(origin + "/")}</link>
    <description>${escapeXml(siteDesc)}</description>
    <language>zh-CN</language>
    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>
    <atom:link href="${escapeXml(selfLink)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}
