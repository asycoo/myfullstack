import { z } from "zod";

/** 原始标签字符串（可含空格、大小写）；服务端再 slug 化 */
export const optionalTagSlugsZ = z.array(z.string()).max(20).optional();
