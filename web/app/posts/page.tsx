import Link from "next/link";
import * as postsService from "@/lib/posts/posts.service";
import type { PostWithAuthor } from "@/lib/posts/posts.repo";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ q?: string | string[] }> };

function firstSearchQ(raw: string | string[] | undefined): string {
  if (raw === undefined) return "";
  const s = Array.isArray(raw) ? raw[0] : raw;
  return typeof s === "string" ? s : "";
}

function PostListItems({ posts }: { posts: PostWithAuthor[] }) {
  if (posts.length === 0) {
    return <p className="mt-4 text-sm text-zinc-600">暂无文章。</p>;
  }
  return (
    <ul className="mt-4 flex flex-col gap-2">
      {posts.map((p) => (
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
  );
}

/** 无需登录：说明路径 + 展示已发布列表（与 GET /api/posts 匿名语义一致）；支持 ?q= 标题/摘要搜索 */
export default async function PostsHubPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const qRaw = firstSearchQ(sp.q).slice(0, 200);
  const q = qRaw.trim();
  const usingSearch = q.length > 0;

  const published: PostWithAuthor[] = usingSearch
    ? (await postsService.searchPublishedPostsForPublic(q, 0, 30)).items
    : await postsService.listPublishedPostsForPublic(0, 30);

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
        <h2 className="text-base font-semibold text-zinc-900">站内搜索</h2>
        <p className="mt-1 text-sm text-zinc-500">
          匹配已发布文章的<strong className="text-zinc-700">标题</strong>或<strong className="text-zinc-700">摘要</strong>（不区分大小写）。接口：{" "}
          <code className="rounded bg-zinc-100 px-1 text-xs">GET /api/posts/search?q=</code>
        </p>
        <form action="/posts" method="get" className="mt-4 flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1">
            <label htmlFor="posts-q" className="sr-only">
              搜索关键词
            </label>
            <input
              id="posts-q"
              name="q"
              type="search"
              defaultValue={usingSearch ? q : ""}
              placeholder="例如：hello、练习"
              autoComplete="off"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            搜索
          </button>
          {usingSearch ? (
            <Link
              href="/posts"
              className="rounded-md border border-zinc-300 px-4 py-2 text-sm text-zinc-800 hover:bg-zinc-50"
            >
              清除
            </Link>
          ) : null}
        </form>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-zinc-900">
          {usingSearch ? `搜索结果：「${q}」` : "已发布"}
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          {usingSearch ? (
            <>
              下列为标题或摘要含关键词的已发布文章（本页最多 30 条）。空关键词不会发起模糊查询。
            </>
          ) : (
            <>
              下列数据与匿名请求 <code className="rounded bg-zinc-100 px-1 text-xs">GET /api/posts</code>{" "}
              一致，不包含草稿。
            </>
          )}
        </p>
        <PostListItems posts={published} />
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
