import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/api";
import { SLUG_PATTERN, slugifyAsciiSegment } from "@/lib/posts/slug";

const MAX_TAGS_PER_POST = 20;
const MAX_TAG_SLUG_LEN = 40;
const MAX_TAG_LABEL_LEN = 40;

/** 由用户输入生成唯一 slug 与可选展示名（中文等非 ASCII 用 `t-{hash}` + label） */
export function tagFromRawInput(raw: string): { slug: string; label: string | null } {
  const trim = raw.trim();
  if (!trim) {
    throw fail("BAD_REQUEST", "标签不能为空");
  }

  const base = slugifyAsciiSegment(trim);
  if (base.length > MAX_TAG_SLUG_LEN) {
    throw fail("BAD_REQUEST", "标签过长");
  }
  if (base && SLUG_PATTERN.test(base)) {
    return { slug: base, label: null };
  }

  const h = createHash("sha256").update(trim, "utf8").digest("hex").slice(0, 12);
  const label = trim.length > MAX_TAG_LABEL_LEN ? trim.slice(0, MAX_TAG_LABEL_LEN) : trim;
  return { slug: `t-${h}`, label };
}

export function rawTagInputsToSpecs(raw: string[]): { slug: string; label: string | null }[] {
  const seen = new Set<string>();
  const out: { slug: string; label: string | null }[] = [];
  for (const r of raw) {
    const t = r.trim();
    if (!t) continue;
    const spec = tagFromRawInput(t);
    if (seen.has(spec.slug)) continue;
    seen.add(spec.slug);
    out.push(spec);
    if (out.length > MAX_TAGS_PER_POST) {
      throw fail("BAD_REQUEST", `每篇文章最多 ${MAX_TAGS_PER_POST} 个标签`);
    }
  }
  return out;
}

export async function listTagsAlphabetical() {
  return prisma.tag.findMany({
    orderBy: { slug: "asc" },
    select: { id: true, slug: true, label: true },
  });
}

/** 替换文章的标签关联（先删后建；空数组表示清空） */
export async function replacePostTags(postId: number, rawSlugs: string[]) {
  const specs = rawTagInputsToSpecs(rawSlugs);

  await prisma.$transaction(async (tx) => {
    await tx.postTag.deleteMany({ where: { postId } });
    for (const { slug, label } of specs) {
      // 有则更新，没有则创建
      const tag = await tx.tag.upsert({
        where: { slug },
        create: { slug, label },
        update: label != null ? { label } : {},
      });
      await tx.postTag.create({
        data: { postId, tagId: tag.id },
      });
    }
  });
}
