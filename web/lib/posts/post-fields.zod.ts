import { z } from "zod";

/** 本站上传封面路径（与 app/api/posts/cover 生成规则一致） */
export const uploadedCoverPathZ = z
  .string()
  .regex(/^\/uploads\/post-covers\/[a-f0-9]{32}\.(?:jpe?g|png|gif|webp)$/i, "无效的本地上传路径");

/** http(s) 外链或本站上传路径 */
export const coverImageStoredZ = z.union([
  z.string().url("须为有效 http(s) 链接").max(2048),
  uploadedCoverPathZ,
]);

/** 可选摘要：空串视为未传；有内容则最长 500 */
export const optionalExcerptZ = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  z.string().trim().min(1).max(500).optional(),
);

/** 可选封面：外链 URL 或本站上传路径；空串视为未传 */
export const optionalCoverImageZ = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  coverImageStoredZ.optional(),
);

/** PATCH：允许空串表示清空数据库字段 */
export const patchExcerptZ = z
  .union([z.string().max(500), z.literal("")])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "" ? null : v.trim()));

export const patchCoverImageZ = z
  .union([coverImageStoredZ, z.literal("")])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "" ? null : typeof v === "string" ? v.trim() : v));
