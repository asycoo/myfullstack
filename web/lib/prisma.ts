import { PrismaClient } from "@/app/generated/prisma/client";

/** 在 schema 增加需新 Client 的字段时递增，便于 dev 下丢弃 global 里缓存的旧 PrismaClient（仍需 `prisma generate`，必要时重启 dev）。 */
const DEV_PRISMA_CLIENT_EPOCH = 2;

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
  prismaClientEpoch?: number;
};

const cached = globalForPrisma.prisma;
// 当你更新了 Prisma schema 并重新 generate 时，旧的 PrismaClient 实例可能仍被热更新缓存着，
// 从而缺少新 model 的 delegate（例如 session）。这里做一个轻量自愈：检测到旧实例就重建。
const sessionMissing = cached ? (cached as unknown as { session?: unknown }).session === undefined : false;
const devEpochMismatch =
  process.env.NODE_ENV !== "production" && globalForPrisma.prismaClientEpoch !== DEV_PRISMA_CLIENT_EPOCH;

const cachedLooksStale = devEpochMismatch || sessionMissing;

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
  globalForPrisma.prismaClientEpoch = DEV_PRISMA_CLIENT_EPOCH;
}
