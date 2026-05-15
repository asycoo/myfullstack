import Link from "next/link";

export default function LabsHomePage() {
  return (
    <main className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-zinc-800">
      <h1 className="text-xl font-semibold text-zinc-900">实验区 /labs</h1>
      <p className="mt-3 text-sm leading-relaxed text-zinc-700">
        按扩展计划，与博客主线弱耦合的功能（短链、Webhook 调试箱等）放在此路径下开发，接口建议使用{" "}
        <code className="rounded bg-white px-1 text-xs">/api/labs/...</code> 前缀。
      </p>
      <p className="mt-2 text-sm text-zinc-600">当前为占位页；后续迭代在此追加子路由与说明。</p>
      <p className="mt-6">
        <Link href="/posts" className="text-sm text-blue-600 hover:underline">
          返回文章入口
        </Link>
      </p>
    </main>
  );
}
