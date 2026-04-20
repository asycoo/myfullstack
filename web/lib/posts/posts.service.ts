import { fail } from "@/lib/api";
import * as repo from "@/lib/posts/posts.repo";

export async function listPosts() {
  return repo.listPosts();
}

export async function createPost(input: { authorId: number; title: string; content?: string }) {
  return repo.createPost(input);
}

async function assertPostOwnedBy(id: number, userId: number, action: "update" | "delete") {
  const post = await repo.getPostAuthor(id);
  if (!post) throw fail("NOT_FOUND", "文章不存在");
  if (post.authorId !== userId) {
    throw fail("FORBIDDEN", action === "delete" ? "无权限删除他人文章" : "无权限操作他人文章");
  }
}

export async function updatePost(
  id: number,
  userId: number,
  data: { title?: string; content?: string; published?: boolean }
) {
  await assertPostOwnedBy(id, userId, "update");
  return repo.updatePost(id, data);
}

export async function deletePost(id: number, userId: number) {
  await assertPostOwnedBy(id, userId, "delete");
  await repo.deletePost(id);
  return { ok: true as const };
}

