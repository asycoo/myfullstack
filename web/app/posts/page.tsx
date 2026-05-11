import Link from "next/link";
import * as postsService from "@/lib/posts/posts.service";

export const dynamic = "force-dynamic";

/** 无需登录：说明路径 + 展示已发布列表（与 GET /api/posts 匿名语义一致） */
export default async function PostsHubPage() {
  const published = await postsService.listPublishedPostsForPublic(0, 30);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 p-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">文章</h1>
        <p className="mt-3 text-zinc-600 leading-relaxed">
          <strong className="text-zinc-800">公开阅读</strong>使用{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">/posts/文章slug</code>
          （如 <code className="rounded bg-zinc-100 px-1 text-xs">/posts/hello-world</code>
          ），<strong className="text-zinc-800">不需要登录</strong>（仅已发布文章可访问）。旧链接{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs">/posts/数字</code> 会 302 到 slug 地址。
        </p>
        <p className="mt-3 text-zinc-600 leading-relaxed">
          <strong className="text-zinc-800">发文、草稿、发布</strong>在作者后台，需要先登录。
        </p>
      </div>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">已发布</h2>
        <p className="mt-1 text-sm text-zinc-500">
          下列数据与匿名请求 <code className="rounded bg-zinc-100 px-1 text-xs">GET /api/posts</code> 一致，不包含草稿。
        </p>
        {published.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">暂无已发布文章。</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {published.map((p) => (
              <li key={p.id} className="flex gap-3 border-b border-zinc-100 py-3 last:border-0">
                {p.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.coverImage}
                    alt=""
                    className="h-16 w-24 shrink-0 rounded object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-16 w-24 shrink-0 rounded bg-zinc-100" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/posts/${encodeURIComponent(p.slug)}`}
                    className="font-medium text-blue-600 underline-offset-2 hover:underline"
                  >
                    {p.title}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-500">{p.author.name ?? p.author.email}</p>
                  {p.excerpt ? (
                    <p className="mt-1 line-clamp-2 text-sm text-zinc-600">{p.excerpt}</p>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ul className="flex flex-col gap-2 text-zinc-800">
        <li>
          <Link href="/posts/manage" className="text-blue-600 underline-offset-2 hover:underline">
            进入文章管理（需登录）
          </Link>
        </li>
        <li>
          <Link href="/login" className="text-blue-600 underline-offset-2 hover:underline">
            登录 / 注册
          </Link>
        </li>
        <li>
          <Link href="/" className="text-blue-600 underline-offset-2 hover:underline">
            返回首页
          </Link>
        </li>
      </ul>
    </main>
  );
}
