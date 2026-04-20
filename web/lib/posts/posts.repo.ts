import { prisma } from "@/lib/prisma";

const authorSelect = { id: true, email: true, name: true } as const;

export type PostWithAuthor = Awaited<ReturnType<typeof listPosts>>[number];

export async function listPosts() {
  return prisma.post.findMany({
    include: {
      author: { select: authorSelect },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createPost(input: { title: string; content?: string; authorId: number }) {
  return prisma.post.create({
    data: {
      title: input.title,
      content: input.content,
      authorId: input.authorId,
    },
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

export async function updatePost(
  id: number,
  data: { title?: string; content?: string; published?: boolean }
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

