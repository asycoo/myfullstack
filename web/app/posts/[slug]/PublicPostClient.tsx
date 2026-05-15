"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Layout, Space, Tag, Typography, message } from "antd";

export type PublicPostClientProps = {
  post: {
    title: string;
    content: string | null;
    excerpt: string | null;
    coverImage: string | null;
    readingTimeMinutes: number;
    createdAt: string;
    author: { name: string | null; email: string };
    tags: { id: number; slug: string; label: string | null }[];
  };
  me: { id: number; email: string; name: string | null } | null;
};

async function postJson(url: string, body: unknown, csrfToken: string | null): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken ?? "" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
    const msg = data?.error && typeof data.error === "object" ? data.error.message : undefined;
    throw new Error(typeof msg === "string" && msg ? msg : "请求失败");
  }
}

export function PublicPostClient({ post, me }: PublicPostClientProps) {
  const router = useRouter();
  const [msgApi, contextHolder] = message.useMessage();
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  const readMinutes =
    typeof post.readingTimeMinutes === "number" && Number.isFinite(post.readingTimeMinutes) && post.readingTimeMinutes >= 1
      ? Math.min(999, Math.round(post.readingTimeMinutes))
      : 1;

  const meLabel = useMemo(() => {
    if (!me) return null;
    return me.name ? `${me.name}（${me.email}）` : me.email;
  }, [me]);

  useEffect(() => {
    if (!me) return;
    (async () => {
      try {
        const res = await fetch("/api/csrf", { credentials: "include" });
        const json = (await res.json()) as { data?: { token?: string } };
        if (res.ok && json?.data?.token) setCsrfToken(json.data.token);
      } catch {
        // 无 token 时退出按钮不可用即可
      }
    })();
  }, [me]);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {contextHolder}
      <Layout.Header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          height: "auto",
          minHeight: 64,
          paddingBlock: 12,
          paddingInline: 16,
          lineHeight: 1.35,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <Typography.Text
            style={{
              color: "#fff",
              fontSize: 16,
              fontWeight: 600,
              display: "block",
            }}
          >
            公开阅读
          </Typography.Text>
          <Typography.Text
            style={{
              color: "rgba(255,255,255,0.72)",
              fontSize: 12,
              display: "block",
              marginTop: 4,
            }}
          >
            {me
              ? "你已登录：可直接阅读；发文与列表请去「文章管理」。"
              : "访客可直接阅读全文，无需登录。"}
          </Typography.Text>
        </div>

        <Space size="small" wrap style={{ flexShrink: 0, justifyContent: "flex-end" }}>
          <Link href="/posts">
            <Button size="small">文章入口</Button>
          </Link>
          <Link href="/">
            <Button size="small">首页</Button>
          </Link>
          {me ? (
            <>
              <Typography.Text style={{ color: "rgba(255,255,255,0.88)", maxWidth: 200 }} ellipsis>
                {meLabel}
              </Typography.Text>
              <Link href="/posts/manage">
                <Button size="small" type="primary">
                  文章管理
                </Button>
              </Link>
              <Button
                size="small"
                danger
                disabled={!csrfToken}
                onClick={async () => {
                  try {
                    await postJson("/api/auth/logout", {}, csrfToken);
                    msgApi.success("已退出");
                    router.refresh();
                  } catch (e: unknown) {
                    msgApi.error(e instanceof Error ? e.message : "退出失败");
                  }
                }}
              >
                退出
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button size="small" type="primary">
                登录
              </Button>
            </Link>
          )}
        </Space>
      </Layout.Header>

      <Layout.Content style={{ padding: 24 }}>
        <div className="mx-auto w-full max-w-3xl">
          <Card>
            <Space orientation="vertical" size="middle" className="w-full">
              <Typography.Title level={3} style={{ margin: 0 }}>
                {post.title}
              </Typography.Title>
              {post.tags.length > 0 ? (
                <Space wrap size={[4, 4]}>
                  {post.tags.map((t) => (
                    <Tag key={t.id}>{t.label?.trim() ? t.label : t.slug}</Tag>
                  ))}
                </Space>
              ) : null}
              <Typography.Text type="secondary">
                作者：{post.author.name ?? post.author.email} · {new Date(post.createdAt).toLocaleString()}
              </Typography.Text>
              <Typography.Text type="secondary">
                阅读约 <Typography.Text strong>{readMinutes}</Typography.Text> 分钟
              </Typography.Text>
              {post.coverImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.coverImage}
                  alt=""
                  className="max-h-64 w-full max-w-2xl rounded object-cover"
                  loading="lazy"
                />
              ) : null}
              {post.excerpt ? (
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  {post.excerpt}
                </Typography.Paragraph>
              ) : null}
              {post.content ? <Typography.Paragraph>{post.content}</Typography.Paragraph> : null}
            </Space>
          </Card>
        </div>
      </Layout.Content>
    </Layout>
  );
}
