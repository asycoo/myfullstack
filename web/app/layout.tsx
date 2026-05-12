import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { getSiteUrl } from "@/lib/site-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: { default: "全栈练习", template: "%s · 全栈练习" },
  description: "Next.js + Prisma 练习项目",
  openGraph: {
    siteName: "全栈练习",
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary",
  },
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
