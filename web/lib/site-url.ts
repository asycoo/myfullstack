/** 与 SEO、sitemap、metadataBase 一致：站点绝对根（无末尾 `/`） */
export function getSiteUrl(): URL {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return new URL(explicit.endsWith("/") ? explicit.slice(0, -1) : explicit);
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return new URL(vercel.startsWith("http") ? vercel : `https://${vercel}`);
  return new URL("http://localhost:3000");
}
