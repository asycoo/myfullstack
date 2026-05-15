# 第 12 周复盘：文章搜索与公开列表的数据库索引

**日期**：2026-05-14  
**范围**：`GET /api/posts/search`（标题/摘要 `ILIKE '%关键词%'`）与匿名 `GET /api/posts`（`published = true` + `ORDER BY "createdAt" DESC`）背后的 `Post` 表查询。

---

## 1. 慢可能出在哪里（问题陈述）

- **模糊搜索**：`title` / `excerpt` 使用「前后都有通配符」的子串匹配（Prisma `contains` + `insensitive` → PostgreSQL `ILIKE '%q%'`）。**普通 B-tree 单列索引**对这种模式**基本帮不上忙**，数据量一大容易退化成 **Sequential Scan** 扫全表。
- **公开列表**：按 `published = true` 过滤并按 `createdAt` 倒序分页。若没有 **(published, createdAt)** 一类组合索引，优化器也可能长期依赖顺序扫描 + 内存排序。

本仓库在开发阶段行数很少，`EXPLAIN ANALYZE` 上往往仍显示 **Seq Scan**（成本估算认为扫全表更便宜），这是**正常现象**；索引的价值在**数据量上升、统计信息更新**后更明显。

---

## 2. 改了什么（迁移与 Prisma）

**迁移文件**：`prisma/migrations/20260514054647_post_published_created_at_idx/migration.sql`

1. **`CREATE EXTENSION IF NOT EXISTS pg_trgm`**  
   启用 **三元组（trigram）** 扩展，用于在 `text` 上建 **GIN** 索引，加速 `LIKE` / `ILIKE` 子串类查询。

2. **GIN 索引（标题、摘要）**

   - `Post_title_trgm_idx`：`USING gin ("title" gin_trgm_ops)`
   - `Post_excerpt_trgm_idx`：`USING gin ("excerpt" gin_trgm_ops)`

   与 `web/lib/posts/posts.repo.ts` 中 `wherePublishedTitleOrExcerptContains` / `whereDashboardTitleOrExcerptContains` 的语义对应。

3. **B-tree 组合索引（列表）**

   - `Post_published_createdAt_idx`：`("published", "createdAt")`

**Prisma schema**：`Post` 模型增加 `@@index([published, createdAt])`，与上述 B-tree 一致，避免仅「手写 SQL」与 schema 长期脱节。

---

## 3. 如何验证（有证据，不靠感觉）

### 3.1 确认索引已创建

在能连上同一数据库的客户端执行：

```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'Post'
ORDER BY indexname;
```

应能看到 `Post_title_trgm_idx`、`Post_excerpt_trgm_idx`、`Post_published_createdAt_idx`（以及原有的主键、唯一、`authorId` 等）。

### 3.2 `EXPLAIN (ANALYZE, BUFFERS)`

仓库提供脚本（会 `source` 项目根下 `web/.env` 的 `DATABASE_URL`）：

```bash
cd web && npm run explain:week12
```

脚本会打印：

1. 与搜索类似的 `EXPLAIN`；
2. 与公开列表类似的 `EXPLAIN`；
3. 临时 **`SET enable_seqscan = off`** 后再对搜索跑一次，用于**在小表上**观察优化器是否更愿意走索引路径（仅作教学演示，**不要在生产会话里长期关闭顺序扫描**）。

**读计划时关注**：`Seq Scan` vs `Bitmap Index Scan` / `Index Scan`、`cost`、`actual time`、`Buffers: shared hit/read`。

---

## 4. 结论（简短）

- **索引不是「加了就一定在计划里出现」**：行数少时 PostgreSQL 仍可能选 Seq Scan；**证据**来自 `EXPLAIN` 与索引清单，而不是单次接口体感。
- **trgm + GIN** 为「标题/摘要模糊搜索」在数据变大时提供**可扩展**的优化方向；**(published, createdAt)** 为公开列表分页提供**对齐访问模式**的 B-tree。
- **部署注意**：部分托管库对 `CREATE EXTENSION pg_trgm` 需控制台预先开启或使用超级用户权限；若迁移失败，先在该环境文档中查「如何启用 pg_trgm」。

---

## 5. 与课表验收的对应

| 课表要求 | 对应物 |
| --- | --- |
| 挑慢查询或列表接口 | 搜索 `ILIKE` + 公开列表排序 |
| 加索引 + `EXPLAIN` | 迁移 + `npm run explain:week12` |
| 结论写入 `DOC/` | 本文 |

12 周主线至此可按计划收尾；后续若要「全文检索」可再演进到 `tsvector` / 外部搜索，与本周的「模糊搜索 + 索引」是不同层级的能力。
