import { notFound, redirect } from "next/navigation";
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

export async function generateMetadata({ params }: PageProps) {
  const raw = decodeSegment((await params).slug);
  if (!raw) return { title: "文章" };

  let post: Awaited<ReturnType<typeof postsService.loadPublishedBySlug>> | null = null;
  if (/^\d+$/.test(raw)) {
    const row = await postsService.loadPostById(Number(raw));
    post = row?.published ? row : null;
  } else {
    post = await postsService.loadPublishedBySlug(raw.toLowerCase());
  }
  return { title: post?.title ?? "文章" };
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
