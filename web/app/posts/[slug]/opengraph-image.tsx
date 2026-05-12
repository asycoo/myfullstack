import { readFileSync } from "node:fs";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { excerptFromContent } from "@/lib/posts/excerpt";
import { loadPublishedPostForPublicPage } from "@/lib/posts/post-public-load";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const alt = "文章分享图";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const NOTO_SC_WOFF = join(
  process.cwd(),
  "node_modules/@fontsource/noto-sans-sc/files/noto-sans-sc-chinese-simplified-400-normal.woff",
);

function loadNotoSansScWoff(): ArrayBuffer {
  return readFileSync(NOTO_SC_WOFF).buffer;
}

function metaDescription(
  title: string,
  excerpt: string | null,
  content: string | null,
): string {
  const fromExcerpt = excerpt?.trim();
  if (fromExcerpt) return fromExcerpt.slice(0, 200);
  const fromContent = excerptFromContent(content ?? undefined, 160);
  if (fromContent) return fromContent;
  return `${title} · 全栈练习`;
}

const ogFonts = [
  {
    name: "Noto Sans SC",
    data: loadNotoSansScWoff(),
    style: "normal" as const,
    weight: 400 as const,
  },
];

const fontFamily = "Noto Sans SC";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawParam } = await params;
  const post = await loadPublishedPostForPublicPage(rawParam);

  if (!post) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            height: "100%",
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "#18181b",
            color: "#a1a1aa",
            fontSize: 42,
            fontFamily,
          }}
        >
          全栈练习 · 文章
        </div>
      ),
      { ...size, fonts: ogFonts },
    );
  }

  const title = post.title.length > 56 ? `${post.title.slice(0, 56)}…` : post.title;
  const sub = metaDescription(post.title, post.excerpt, post.content).slice(0, 160);
  const footer = `全栈练习 · 约阅读 ${post.readingTimeMinutes} 分钟`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          height: "100%",
          width: "100%",
          backgroundColor: "#27272a",
          padding: 72,
        }}
      >
        <div style={{ fontSize: 54, fontWeight: 700, color: "#fafafa", lineHeight: 1.2, fontFamily }}>{title}</div>
        <div style={{ marginTop: 32, fontSize: 28, color: "#a1a1aa", lineHeight: 1.45, fontFamily }}>{sub}</div>
        <div style={{ marginTop: 44, fontSize: 22, color: "#71717a", fontFamily }}>{footer}</div>
      </div>
    ),
    { ...size, fonts: ogFonts },
  );
}
