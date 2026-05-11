import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { requireUser } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { requireCsrf } from "@/lib/csrf/csrf.service";
import { getClientIp } from "@/lib/ratelimit/ip";
import { rateLimitOrThrow } from "@/lib/ratelimit/ratelimit";
import { safeError } from "@/lib/log/safe-log";

export const dynamic = "force-dynamic";

const UPLOAD_REL = "uploads/post-covers";
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

    const name = `${randomBytes(16).toString("hex")}.${ext}`;
    const dir = path.join(process.cwd(), "public", UPLOAD_REL);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, name), buf);

    const urlPath = `/${UPLOAD_REL}/${name}`;
    return ok({ url: urlPath });
  } catch (e: unknown) {
    if (e instanceof Response) return e;
    safeError("upload post cover failed", { route: "/api/posts/cover", method: "POST", ip, err: e });
    return fail("INTERNAL_ERROR", "封面上传失败");
  }
}
