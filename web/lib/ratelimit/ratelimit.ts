import { fail } from "@/lib/api";

type Bucket = {
  count: number;
  resetAt: number; // ms epoch
};

const buckets = new Map<string, Bucket>();

function getWindow(now: number, windowMs: number) {
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  return { windowStart, resetAt };
}

export function rateLimitOrThrow(input: { key: string; limit: number; windowMs: number; now?: number }) {
  const now = input.now ?? Date.now();
  const { resetAt } = getWindow(now, input.windowMs);

  const existing = buckets.get(input.key);
  if (existing && existing.resetAt <= now) {
    buckets.delete(input.key);
  }

  const bucket = buckets.get(input.key) ?? { count: 0, resetAt };
  // 如果 key 第一次出现，或者 windowMs 变化导致 resetAt 不一致，刷新 resetAt
  if (bucket.resetAt !== resetAt) bucket.resetAt = resetAt;

  bucket.count += 1;
  buckets.set(input.key, bucket);

  if (bucket.count > input.limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    throw fail("TOO_MANY_REQUESTS", "请求过于频繁，请稍后再试", {
      headers: {
        "Retry-After": String(retryAfterSeconds),
      },
    });
  }

  return { remaining: Math.max(0, input.limit - bucket.count), resetAt };
}

