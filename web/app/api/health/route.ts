import { isRedisConfigured, redisPing } from "@/lib/redis/client";

export const dynamic = "force-dynamic";

export async function GET() {
  let redis: "ok" | "skipped" | "down" = "skipped";
  if (isRedisConfigured()) {
    redis = (await redisPing()) ? "ok" : "down";
  }

  return Response.json({
    ok: true,
    message: "API is running",
    time: new Date().toISOString(),
    redis,
  });
}
