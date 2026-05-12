import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import "./globals.css";

function appMetadataBase(): URL {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) return new URL(explicit.endsWith("/") ? explicit.slice(0, -1) : explicit);
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return new URL(vercel.startsWith("http") ? vercel : `https://${vercel}`);
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: appMetadataBase(),
  title: { default: "全栈练习", template: "%s · 全栈练习" },
  description: "Next.js + Prisma 练习项目",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
    >
      <body className="min-h-full flex flex-col">
        <AntdRegistry>{children}</AntdRegistry>
      </body>
    </html>
  );
}
