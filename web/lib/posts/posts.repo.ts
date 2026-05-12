import { prisma } from "@/lib/prisma";

const authorSelect = { id: true, email: true, name: true } as const;

const postListInclude = {
  include: {
    author: { select: authorSelect },
  },
  orderBy: { createdAt: "desc" as const },
};

export type PostWithAuthor = Awaited<ReturnType<typeof listPublishedPosts>>[number];

/** 公开列表：仅已发布 */
export async function listPublishedPosts(skip: number, take: number) {
  return prisma.post.findMany({
    where: { published: true },
    ...postListInclude,
    skip,
    take,
  });
}

/**
 * 登录用户后台列表：所有人可见的已发布文章 + 当前用户自己的未发布（草稿）
 */
function dashboardWhere(userId: number) {
  return { OR: [{ published: true }, { authorId: userId }] };
}

export async function listPostsVisibleToUser(userId: number, skip: number, take: number) {
  return prisma.post.findMany({
    where: dashboardWhere(userId),
    ...postListInclude,
    skip,
    take,
  });
}

export async function countPublishedPosts() {
  return prisma.post.count({ where: { published: true } });
}

/** 站点地图：仅已发布文章的 slug / 更新时间（含 limit 防止极端大量） */
export async function listPublishedSlugsForSitemap(take: number) {
  return prisma.post.findMany({
    where: { published: true },
    select: { slug: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
    take,
  });
}

export async function countPostsVisibleToUser(userId: number) {
  return prisma.post.count({ where: dashboardWhere(userId) });
}

export async function createPost(input: {
  title: string;
  content?: string;
  authorId: number;
  slug: string;
  excerpt?: string | null;
  coverImage?: string | null;
}) {
  return prisma.post.create({
    data: {
      title: input.title,
      content: input.content,
      authorId: input.authorId,
      slug: input.slug,
      excerpt: input.excerpt ?? undefined,
      coverImage: input.coverImage ?? undefined,
    },
    include: {
      author: { select: authorSelect },
    },
  });
}

/** 是否存在「其他文章」已占用该 slug（创建时不传 excludeId；更新时排除自身） */
export async function isSlugTakenByOther(slug: string, excludePostId?: number) {
  const row = await prisma.post.findFirst({
    where: {
      slug,
      ...(excludePostId !== undefined ? { id: { not: excludePostId } } : {}),
    },
    select: { id: true },
  });
  return !!row;
}

export async function findPublishedPostBySlug(slug: string) {
  return prisma.post.findFirst({
    where: { slug, published: true },
    include: {
      author: { select: authorSelect },
    },
  });
}

export async function getPostAuthor(id: number) {
  return prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });
}

export async function getPostById(id: number) {
  return prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: authorSelect },
    },
  });
}

export async function updatePost(
  id: number,
  data: {
    title?: string;
    content?: string;
    published?: boolean;
    slug?: string;
    excerpt?: string | null;
    coverImage?: string | null;
  }
) {
  return prisma.post.update({
    where: { id },
    data,
    include: {
      author: { select: authorSelect },
    },
  });
}

export async function deletePost(id: number) {
  return prisma.post.delete({ where: { id } });
}

