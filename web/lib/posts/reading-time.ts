/**
 * 按「标题 + 正文」估算阅读分钟：CJK 单字计 1 单位，拉丁语系按空白分词计 1 单位；
 * 约 350 单位/分钟，至少 1 分钟、上限 999（防止异常长文）。
 */
export function estimateReadingMinutes(title: string, content: string | null | undefined): number {
  const raw = `${title}\n${content ?? ""}`.trim();
  if (!raw) return 1;
  const cjkPattern = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g;
  const cjk = raw.match(cjkPattern)?.length ?? 0;
  const rest = raw.replace(cjkPattern, " ").trim();
  const words = rest ? rest.split(/\s+/).filter(Boolean).length : 0;
  const units = cjk + words;
  const minutes = Math.ceil(units / 350);
  return Math.min(999, Math.max(1, minutes));
}

/** 详情页展示：库里有合法值用库；否则按标题+正文现算（兼容旧数据或未迁移库） */
export function displayReadingMinutes(
  stored: number | null | undefined,
  title: string,
  content: string | null | undefined,
): number {
  if (typeof stored === "number" && Number.isFinite(stored) && stored >= 1) {
    return Math.min(999, Math.round(stored));
  }
  return estimateReadingMinutes(title, content);
}
