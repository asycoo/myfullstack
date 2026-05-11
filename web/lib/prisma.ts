import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

const cached = globalForPrisma.prisma;
// 当你更新了 Prisma schema 并重新 generate 时，旧的 PrismaClient 实例可能仍被热更新缓存着，
// 从而缺少新 model 的 delegate（例如 session）。这里做一个轻量自愈：检测到旧实例就重建。
const cachedLooksStale = cached ? (cached as unknown as { session?: unknown }).session === undefined : false;

export const prisma =
  (!cached || cachedLooksStale
    ? new PrismaClient({
        log: ["query", "error", "warn"],
      })
    : cached) ??
  new PrismaClient({
    log: ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
