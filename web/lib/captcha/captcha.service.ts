import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

import { getRedis, isRedisConfigured } from "@/lib/redis/client";

const CAPTCHA_PREFIX = "captcha:";
const CAPTCHA_TTL_SEC = 180;

function captchaHmacSecret(): string {
  return process.env.CAPTCHA_SECRET?.trim() || "dev-captcha-secret-change-in-production";
}

function signAnswer(captchaId: string, answer: string): string {
  const norm = answer.trim();
  return createHmac("sha256", captchaHmacSecret()).update(`${captchaId}:${norm}`).digest("hex");
}

export type CaptchaChallenge = {
  captchaId: string;
  question: string;
};

/** 生成算术验证码并写入 Redis（TTL）；未配置 Redis 时由路由返回 disabled */
export async function createMathCaptcha(): Promise<CaptchaChallenge> {
  const redis = getRedis();
  if (!redis) throw new Error("Redis client unavailable");

  const a = randomInt(1, 20);
  const b = randomInt(1, 20);
  const sum = a + b;
  const captchaId = randomBytes(16).toString("hex");
  const payload = signAnswer(captchaId, String(sum));

  await redis.set(`${CAPTCHA_PREFIX}${captchaId}`, payload, "EX", CAPTCHA_TTL_SEC);

  return {
    captchaId,
    question: `${a} + ${b} = ?`,
  };
}

/**
 * 校验并消费验证码（成功则 DEL，防重放；失败保留 key 至 TTL 以便限次尝试）。
 * 未启用 Redis 时返回 true（由登录路由决定是否要求传参）。
 */
export async function verifyAndConsumeCaptcha(captchaId: string, answerRaw: string): Promise<boolean> {
  if (!isRedisConfigured()) return true;

  const redis = getRedis();
  if (!redis) return false;

  const id = captchaId.trim();
  const answer = answerRaw.trim();
  if (!id || !answer) return false;

  const key = `${CAPTCHA_PREFIX}${id}`;
  const stored = await redis.get(key);
  if (!stored) return false;

  const expected = signAnswer(id, answer);
  const a = Buffer.from(stored, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return false;
  }

  await redis.del(key);
  return true;
}
