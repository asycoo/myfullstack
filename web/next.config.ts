import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

// 上层目录存在额外 lockfile 时，Turbopack 可能把 workspace root 推断错，进而出现依赖解析异常。
// 这里把 root 固定为 Next 应用目录（本文件所在目录，即 web/）。
const appDir = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  turbopack: {
    root: appDir,
  },
  /** 本地上传封面由 Route Handler 读盘提供，避免 dev 下运行时写入 public 的文件无法访问 */
  async rewrites() {
    return [
      { source: "/uploads/post-covers/:name", destination: "/api/uploads/post-covers/:name" },
    ];
  },
};

export default nextConfig;
