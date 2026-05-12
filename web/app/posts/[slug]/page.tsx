import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

import { excerptFromContent } from "@/lib/posts/excerpt";
import * as postsService from "@/lib/posts/posts.service";
import { getCurrentUser } from "@/lib/session/session.service";
import { PublicPostClient } from "./PublicPostClient";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

function decodeSegment(raw: string) {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return "";
  }
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

/** Next.js App Router 约定：与本文件 `default` 导出同路由时由框架在服务端自动调用，用于 `<head>` / OG，无需业务代码引用。 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const raw = decodeSegment((await params).slug);
  if (!raw) return { title: "文章" };

  let post: Awaited<ReturnType<typeof postsService.loadPublishedBySlug>> | null = null;
  if (/^\d+$/.test(raw)) {
    const row = await postsService.loadPostById(Number(raw));
    post = row?.published ? row : null;
  } else {
    post = await postsService.loadPublishedBySlug(raw.toLowerCase());
  }
  if (!post) return { title: "文章" };

  const title = post.title;
  const description = metaDescription(title, post.excerpt, post.content);
  const path = `/posts/${encodeURIComponent(post.slug)}`;
  const cover = post.coverImage?.trim();
  const images =
    cover && (cover.startsWith("http://") || cover.startsWith("https://") || cover.startsWith("/"))
      ? [{ url: cover }]
      : undefined;

  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      type: "article",
      url: path,
      ...(images ? { images } : {}),
    },
    twitter: {
      card: images ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}

export default async function PublicPostPage({ params }: PageProps) {
  const raw = decodeSegment((await params).slug);
  if (!raw) notFound();

  if (/^\d+$/.test(raw)) {
    const row = await postsService.loadPostById(Number(raw));
    if (row?.published) {
      redirect(`/posts/${encodeURIComponent(row.slug)}`);
    }
    notFound();
  }

  const slug = raw.toLowerCase();
  const post = await postsService.loadPublishedBySlug(slug);
  if (!post) notFound();

  const clientPost = {
    title: post.title,
    content: post.content,
    excerpt: post.excerpt,
    coverImage: post.coverImage,
    createdAt: post.createdAt.toISOString(),
    author: {
      name: post.author.name,
      email: post.author.email,
    },
  };

  const me = await getCurrentUser();

  return <PublicPostClient post={clientPost} me={me} />;
}
