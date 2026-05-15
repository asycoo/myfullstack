import Redis from "ioredis";

import { safeError } from "@/lib/log/safe-log";

function redisUrl(): string | undefined {
  const u = process.env.REDIS_URL?.trim();
  return u || undefined;
}

/** 未配置 REDIS_URL 时视为「未启用 Redis」 */
export function isRedisConfigured(): boolean {
  return !!redisUrl();
}

const globalForRedis = globalThis as typeof globalThis & { __redisClient?: Redis | null };

function createClient(): Redis {
  const url = redisUrl();
  if (!url) throw new Error("REDIS_URL is not set");
  return new Redis(url, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
}

/** 单例；仅在有 REDIS_URL 时使用。勿在 Edge Runtime 调用。 */
export function getRedis(): Redis | null {
  if (!isRedisConfigured()) return null;
  if (!globalForRedis.__redisClient) {
    globalForRedis.__redisClient = createClient();
  }
  return globalForRedis.__redisClient;
}

export async function redisPing(): Promise<boolean> {
  const r = getRedis();
  if (!r) return false;
  try {
    const pong = await r.ping();
    return pong === "PONG";
  } catch (e: unknown) {
    safeError("redis ping failed", { err: e });
    return false;
  }
}
