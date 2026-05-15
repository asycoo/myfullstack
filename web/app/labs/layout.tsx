import type { ReactNode } from "react";
import Link from "next/link";

export default function LabsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <span className="text-sm font-medium text-zinc-800">实验室</span>
          <nav className="flex gap-3 text-sm">
            <Link href="/labs" className="text-blue-600 hover:underline">
              概览
            </Link>
            <Link href="/" className="text-zinc-600 hover:underline">
              首页
            </Link>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-3xl px-4 py-8">{children}</div>
    </div>
  );
}
