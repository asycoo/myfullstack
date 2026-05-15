-- 第 12 周：列表 + 标题/摘要模糊搜索（ILIKE %q%）性能
-- pg_trgm：支持 GIN 上的三元组匹配，加速 contains / ILIKE 子串查询
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Prisma：公开列表 WHERE published = true ORDER BY createdAt DESC
CREATE INDEX "Post_published_createdAt_idx" ON "Post"("published", "createdAt");

-- 与 search 中 title / excerpt 的 ILIKE '%关键词%' 对应（见 posts.repo where*Contains）
CREATE INDEX "Post_title_trgm_idx" ON "Post" USING gin ("title" gin_trgm_ops);
CREATE INDEX "Post_excerpt_trgm_idx" ON "Post" USING gin ("excerpt" gin_trgm_ops);
