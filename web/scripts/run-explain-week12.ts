/**
 * 第 12 周：打印 EXPLAIN ANALYZE 结果（需 DATABASE_URL）
 * 用法：`cd web && npm run explain:week12`（会 source `.env` 中的 `DATABASE_URL`）
 */
import { PrismaClient } from "../app/generated/prisma/client";

const prisma = new PrismaClient();

async function explain(label: string, sql: string) {
  console.log(`\n=== ${label} ===\n`);
  const rows = await prisma.$queryRawUnsafe<Record<string, string>[]>(sql);
  for (const row of rows) {
    console.log(Object.values(row)[0]);
  }
}

async function main() {
  await explain(
    "搜索形态（与 /api/posts/search 公开分支类似）",
    `EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM "Post" WHERE "published" = true AND ("title" ILIKE '%RSS%' OR "excerpt" ILIKE '%RSS%') LIMIT 20`,
  );

  await explain(
    "公开列表形态（ORDER BY createdAt DESC）",
    `EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM "Post" WHERE "published" = true ORDER BY "createdAt" DESC LIMIT 30`,
  );

  await prisma.$executeRawUnsafe(`SET enable_seqscan = off`);
  try {
    await explain(
      "同上搜索，enable_seqscan=off（小表时便于观察是否可走 GIN）",
      `EXPLAIN (ANALYZE, BUFFERS) SELECT id FROM "Post" WHERE "published" = true AND ("title" ILIKE '%RSS%' OR "excerpt" ILIKE '%RSS%') LIMIT 20`,
    );
  } finally {
    await prisma.$executeRawUnsafe(`SET enable_seqscan = on`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
