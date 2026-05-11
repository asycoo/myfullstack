import { randomBytes } from "node:crypto";

import { put } from "@vercel/blob";

import { requireUser } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { requireCsrf } from "@/lib/csrf/csrf.service";
import { getClientIp } from "@/lib/ratelimit/ip";
import { rateLimitOrThrow } from "@/lib/ratelimit/ratelimit";
import { safeError } from "@/lib/log/safe-log";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2 * 1024 * 1024;

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

export async function POST(request: Request) {
  const ip = getClientIp(request);
  try {
    await requireCsrf(request);
    const user = await requireUser();
    rateLimitOrThrow({ key: `post:cover-upload:${user.id}`, limit: 20, windowMs: 60_000 });

    const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
    if (!token) {
      return fail("INTERNAL_ERROR", "未配置环境变量 BLOB_READ_WRITE_TOKEN，无法上传到 Vercel Blob。", {
        status: 503,
      });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || !(file instanceof File)) {
      return fail("BAD_REQUEST", "缺少文件字段 file");
    }

    const ext = MIME_TO_EXT[file.type];
    if (!ext) {
      return fail("BAD_REQUEST", "仅支持 jpeg、png、gif、webp");
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length === 0) return fail("BAD_REQUEST", "文件为空");
    if (buf.length > MAX_BYTES) return fail("BAD_REQUEST", "图片不能超过 2MB");

    const pathname = `post-covers/${randomBytes(16).toString("hex")}.${ext}`;

    const uploaded = await put(pathname, buf, {
      access: "public",
      token,
      contentType: file.type,
    });

    return ok({ url: uploaded.url });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("private store") || msg.includes("public access on a private")) {
      return fail(
        "BAD_REQUEST",
        "当前 Vercel Blob Store 为「仅私有」，与公开封面展示不兼容。请在 Vercel → Storage → Create → Blob 新建「Public / 公开」存储，或在该 Store 设置中改为公开；将对应项目的 BLOB_READ_WRITE_TOKEN 写入环境变量后重试。",
      );
    }
    safeError("upload post cover failed", { route: "/api/posts/cover", method: "POST", ip, err: e });
    return fail("INTERNAL_ERROR", "封面上传失败");
  }
}
