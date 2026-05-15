/** 仅抽取小写字母数字与连字符，不做「空则 post」回退（供标签等复用） */
export function slugifyAsciiSegment(input: string): string {
  const t = input.trim().toLowerCase();
  return t
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

/**
 * 将标题规范为 URL 片段：小写、空白与非法字符为连字符、去首尾连字符。
 * 若结果为空或仅为数字（避免与旧 /posts/:id 混淆），使用 `post` 或 `post-{n}` 风格基名由调用方再分配唯一后缀。
 */
export function slugifyTitle(title: string): string {
  const base = slugifyAsciiSegment(title);
  if (!base) return "post";
  if (/^\d+$/.test(base)) return `post-${base}`;
  return base;
}

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
