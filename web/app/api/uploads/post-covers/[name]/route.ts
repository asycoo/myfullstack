import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const NAME_RE = /^[a-f0-9]{32}\.(?:jpe?g|png|gif|webp)$/i;

const EXT_TO_MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
};

function contentTypeForFilename(filename: string): string {
  const ext = path.extname(filename).slice(1).toLowerCase();
  return EXT_TO_MIME[ext] ?? "application/octet-stream";
}

/**
 * 从磁盘读取本地上传封面（与 POST /api/posts/cover 写入路径一致）。
 * 通过 next.config 将 /uploads/post-covers/:name 重写到此路由，避免 dev/部分环境下
 * 运行时写入 public 的文件无法被静态服务识别。
 */
export async function GET(_request: Request, ctx: { params: Promise<{ name: string }> }) {
  const raw = (await ctx.params).name;
  const name = path.basename(raw);
  if (!NAME_RE.test(name)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const root = path.join(process.cwd(), "public", "uploads", "post-covers");
  const filePath = path.join(root, name);
  // 若相对路径以 .. 开头，说明 filePath 落在 root 目录之外（试图读到别的目录），按 404 拒绝，避免把任意磁盘路径读出来。
  if (path.relative(root, filePath).startsWith("..")) {
    return new NextResponse("Not Found", { status: 404 });
  }

  let buf: Buffer;
  try {
    buf = await readFile(filePath);
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": contentTypeForFilename(name),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
