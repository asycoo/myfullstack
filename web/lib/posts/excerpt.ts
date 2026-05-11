/** 未手写摘要时，从正文截取一段作列表/SEO 用（不含 HTML，按纯文本截断） */
export function excerptFromContent(content: string | undefined, maxLen = 200): string | undefined {
  if (!content) return undefined;
  const t = content.trim().replace(/\s+/g, " ");
  if (!t) return undefined;
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}
