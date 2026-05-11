"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormInstance } from "antd";
import {
  Button,
  Card,
  Form,
  Input,
  Layout,
  List,
  Modal,
  Pagination,
  Popconfirm,
  Space,
  Switch,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";

type SafeUser = { id: number; email: string; name: string | null } | null;
type PostItem = {
  id: number;
  slug: string;
  title: string;
  content: string | null;
  excerpt: string | null;
  coverImage: string | null;
  published: boolean;
  createdAt: string;
  author: { id: number; email: string; name: string | null };
};

const PAGE_SIZE = 5;

type ThrownApiError = { status: number; data: unknown };

function isThrownApiError(e: unknown): e is ThrownApiError {
  return (
    typeof e === "object" &&
    e !== null &&
    "status" in e &&
    typeof (e as { status?: unknown }).status === "number" &&
    "data" in e
  );
}

function getApiErrorMessage(e: unknown) {
  if (!isThrownApiError(e)) return "请求失败";
  const data = e.data;
  if (typeof data !== "object" || data === null) return "请求失败";

  const error = (data as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    const msg = (error as { message?: unknown }).message;
    if (typeof msg === "string" && msg) return msg;
  }
  return "请求失败";
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "include" });
  const data = (await res.json()) as T;
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function postJson<T>(url: string, body: unknown, csrfToken: string | null): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken ?? "" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T;
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function patchJson<T>(url: string, body: unknown, csrfToken: string | null): Promise<T> {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken ?? "" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T;
  if (!res.ok) throw { status: res.status, data };
  return data;
}

async function deleteJson<T>(url: string, csrfToken: string | null): Promise<T> {
  const res = await fetch(url, {
    method: "DELETE",
    headers: { "x-csrf-token": csrfToken ?? "" },
    credentials: "include",
  });
  const data = (await res.json()) as T;
  if (!res.ok) throw { status: res.status, data };
  return data;
}

function coverPreviewSrc(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!v) return null;
  if (v.startsWith("https://") || v.startsWith("http://")) return v;
  if (v.startsWith("/")) return v;
  return null;
}

function CoverImageControls({
  form,
  csrfToken,
  msgApi,
}: {
  form: FormInstance;
  csrfToken: string | null;
  msgApi: ReturnType<typeof message.useMessage>[0];
}) {
  const [uploading, setUploading] = useState(false);
  const coverValue = Form.useWatch("coverImage", form);
  const previewSrc = useMemo(() => coverPreviewSrc(coverValue), [coverValue]);

  return (
    <Space orientation="vertical" size="small" className="w-full">
      <Form.Item name="coverImage" noStyle>
        <Input placeholder="上传后自动填入；或直接粘贴 https://… 外链" allowClear />
      </Form.Item>
      {previewSrc ? (
        <div className="flex flex-col gap-1">
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            预览
          </Typography.Text>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewSrc}
            alt=""
            className="max-h-40 max-w-full rounded border border-zinc-200 object-contain"
            loading="lazy"
          />
        </div>
      ) : null}
      <Upload
        accept="image/jpeg,image/png,image/gif,image/webp"
        maxCount={1}
        showUploadList={false}
        disabled={!csrfToken}
        customRequest={async (opt) => {
          setUploading(true);
          try {
            const fd = new FormData();
            fd.append("file", opt.file as File);
            const res = await fetch("/api/posts/cover", {
              method: "POST",
              headers: { "x-csrf-token": csrfToken ?? "" },
              credentials: "include",
              body: fd,
            });
            const json = (await res.json()) as {
              data?: { url?: string };
              error?: { message?: string };
            };
            if (!res.ok) {
              msgApi.error(json?.error?.message ?? "上传失败");
              opt.onError?.(new Error("upload failed"));
              return;
            }
            const url = json.data?.url;
            if (!url) {
              msgApi.error("响应无效");
              opt.onError?.(new Error("invalid response"));
              return;
            }
            form.setFieldValue("coverImage", url);
            msgApi.success("封面上传成功");
            opt.onSuccess?.(json, new XMLHttpRequest());
          } catch {
            msgApi.error("上传失败");
            opt.onError?.(new Error("upload failed"));
          } finally {
            setUploading(false);
          }
        }}
      >
        <Button type="default" loading={uploading} disabled={!csrfToken}>
          选择图片上传
        </Button>
      </Upload>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        本地保存至 public（≤2MB）。部署到无持久磁盘的环境时请改用 OSS / R2 等对象存储。
      </Typography.Text>
    </Space>
  );
}

export default function PostsManagePage() {
  const router = useRouter();
  const [msgApi, contextHolder] = message.useMessage();

  const [me, setMe] = useState<SafeUser>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [listTotal, setListTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [publishingId, setPublishingId] = useState<number | null>(null);
  const [editing, setEditing] = useState<PostItem | null>(null);
  const [createForm] = Form.useForm<{
    title: string;
    content?: string;
    excerpt?: string;
    coverImage?: string;
  }>();
  const [editForm] = Form.useForm<{
    title: string;
    content?: string;
    published: boolean;
    slug?: string;
    excerpt?: string;
    coverImage?: string;
  }>();

  const meLabel = useMemo(() => {
    if (!me) return "未登录";
    return me.name ? `${me.name}（${me.email}）` : me.email;
  }, [me]);

  async function refreshMe() {
    setLoadingMe(true);
    try {
      const res = await getJson<{ data: SafeUser }>("/api/me");
      setMe(res.data);
      return res.data;
    } finally {
      setLoadingMe(false);
    }
  }

  async function refreshPosts(nextPage?: number) {
    const targetPage = nextPage ?? page;
    setLoadingPosts(true);
    try {
      const res = await getJson<{ data: { items: PostItem[]; total: number } }>(
        `/api/posts?page=${targetPage}&pageSize=${PAGE_SIZE}`,
      );
      setPosts(res.data.items);
      setListTotal(res.data.total);
      setPage(targetPage);
    } finally {
      setLoadingPosts(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const current = await refreshMe();
        if (!current) {
          setLoadingPosts(false);
          return;
        }
        const csrf = await getJson<{ data: { token: string } }>("/api/csrf");
        setCsrfToken(csrf.data.token);
        await refreshPosts();
      } catch (e: unknown) {
        msgApi.error(getApiErrorMessage(e) ?? "加载失败");
        setLoadingPosts(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isMine = (item: PostItem) => !!me && item.author.id === me.id;

  if (loadingMe) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        {contextHolder}
        <Layout.Content
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <Typography.Text>加载中…</Typography.Text>
        </Layout.Content>
      </Layout>
    );
  }

  if (!me) {
    return (
      <Layout style={{ minHeight: "100vh" }}>
        {contextHolder}
        <Layout.Header style={{ display: "flex", alignItems: "center" }}>
          <Space style={{ width: "100%", justifyContent: "space-between" }}>
            <Space>
              <Typography.Text style={{ color: "white" }}>文章管理</Typography.Text>
              <Link href="/">
                <Button size="small">首页</Button>
              </Link>
              <Link href="/posts">
                <Button size="small">文章入口</Button>
              </Link>
            </Space>
            <Link href="/login">
              <Button size="small" type="primary">
                去登录
              </Button>
            </Link>
          </Space>
        </Layout.Header>
        <Layout.Content style={{ padding: 24 }}>
          <div className="mx-auto w-full max-w-xl">
            <Card title="需要登录">
              <Space orientation="vertical" size="middle" className="w-full">
                <Typography.Paragraph style={{ marginBottom: 0 }}>
                  这里是<strong>作者后台</strong>：发文、编辑、发布列表。此页需要登录后才能操作。
                </Typography.Paragraph>
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  <strong>公开阅读</strong>请直接打开{" "}
                  <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-sm">/posts/文章slug</code>
                  （已发布文章），<strong>不需要登录</strong>。说明与链接见{" "}
                  <Link href="/posts">/posts</Link>。
                </Typography.Paragraph>
                <Link href="/login">
                  <Button type="primary">去登录 / 注册</Button>
                </Link>
              </Space>
            </Card>
          </div>
        </Layout.Content>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {contextHolder}
      <Layout.Header style={{ display: "flex", alignItems: "center" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Space>
            <Typography.Text style={{ color: "white" }}>文章管理</Typography.Text>
            <Link href="/">
              <Button size="small">首页</Button>
            </Link>
            <Link href="/posts">
              <Button size="small">文章入口</Button>
            </Link>
          </Space>
          <Space>
            <Typography.Text style={{ color: "rgba(255,255,255,0.85)" }}>{meLabel}</Typography.Text>
            <Button
              danger
              size="small"
              onClick={async () => {
                try {
                  await postJson("/api/auth/logout", {}, csrfToken);
                  msgApi.success("已退出");
                  router.replace("/login");
                } catch (e: unknown) {
                  msgApi.error(getApiErrorMessage(e) ?? "退出失败");
                }
              }}
            >
              退出
            </Button>
          </Space>
        </Space>
      </Layout.Header>

      <Layout.Content style={{ padding: 24 }}>
        <div className="mx-auto w-full max-w-3xl">
          <Space orientation="vertical" size="large" className="w-full">
            <Card title="新建文章">
              <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
                新建后默认为<strong>草稿</strong>，不会在公开列表出现；保存后在下方列表点击「上架」或对读者公开。
              </Typography.Paragraph>
              <Form
                form={createForm}
                layout="vertical"
                requiredMark={false}
                onFinish={async (values: {
                  title: string;
                  content?: string;
                  excerpt?: string;
                  coverImage?: string;
                }) => {
                  setCreating(true);
                  try {
                    await postJson("/api/posts", values, csrfToken);
                    msgApi.success("已保存为草稿");
                    createForm.resetFields();
                    await refreshPosts(1);
                  } catch (e: unknown) {
                    if (isThrownApiError(e) && e.status === 401) {
                      msgApi.warning("登录已过期，请重新登录");
                      router.replace("/login");
                      return;
                    }
                    msgApi.error(getApiErrorMessage(e) ?? "发布失败");
                  } finally {
                    setCreating(false);
                  }
                }}
              >
                <Form.Item
                  label="标题"
                  name="title"
                  rules={[{ required: true, message: "请输入标题" }]}
                >
                  <Input placeholder="例如：我的第一篇登录后文章" />
                </Form.Item>
                <Form.Item label="内容" name="content">
                  <Input.TextArea placeholder="可选" autoSize={{ minRows: 3, maxRows: 8 }} />
                </Form.Item>
                <Form.Item
                  label="摘要（excerpt）"
                  name="excerpt"
                  extra="不填时，保存后会用正文前约 200 字自动生成摘要。"
                >
                  <Input.TextArea placeholder="列表与卡片展示用，最多 500 字" maxLength={500} showCount rows={2} />
                </Form.Item>
                <Form.Item
                  label="封面图"
                  extra="可本地上传或粘贴外链；留空则不显示封面。"
                >
                  <CoverImageControls form={createForm} csrfToken={csrfToken} msgApi={msgApi} />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={creating}>
                  保存草稿
                </Button>
              </Form>
            </Card>

            <Card
              title="文章列表"
              extra={
                <Button onClick={() => void refreshPosts()} loading={loadingPosts}>
                  刷新
                </Button>
              }
            >
              <List
                loading={loadingPosts}
                dataSource={posts}
                locale={{ emptyText: "还没有文章，先发一篇吧" }}
                renderItem={(item) => (
                  <List.Item
                    actions={
                      isMine(item)
                        ? [
                            <Button
                              key="edit"
                              size="small"
                              onClick={() => {
                                setEditing(item);
                                editForm.setFieldsValue({
                                  title: item.title,
                                  content: item.content ?? undefined,
                                  published: item.published,
                                  slug: item.slug,
                                  excerpt: item.excerpt ?? "",
                                  coverImage: item.coverImage ?? "",
                                });
                              }}
                            >
                              编辑
                            </Button>,
                            item.published ? (
                              <Popconfirm
                                key="unpublish"
                                title="撤下后读者将无法从公开链接访问，确定吗？"
                                okText="撤下"
                                cancelText="取消"
                                onConfirm={async () => {
                                  setPublishingId(item.id);
                                  try {
                                    await patchJson(`/api/posts/${item.id}`, { published: false }, csrfToken);
                                    msgApi.success("已撤下");
                                    await refreshPosts();
                                  } catch (e: unknown) {
                                    if (isThrownApiError(e) && e.status === 401) {
                                      msgApi.warning("登录已过期，请重新登录");
                                      router.replace("/login");
                                      return;
                                    }
                                    msgApi.error(getApiErrorMessage(e) ?? "操作失败");
                                  } finally {
                                    setPublishingId(null);
                                  }
                                }}
                              >
                                <Button size="small" loading={publishingId === item.id}>
                                  撤下
                                </Button>
                              </Popconfirm>
                            ) : (
                              <Button
                                key="publish"
                                size="small"
                                type="primary"
                                loading={publishingId === item.id}
                                onClick={async () => {
                                  setPublishingId(item.id);
                                  try {
                                    await patchJson(`/api/posts/${item.id}`, { published: true }, csrfToken);
                                    msgApi.success("已上架，读者可访问");
                                    await refreshPosts();
                                  } catch (e: unknown) {
                                    if (isThrownApiError(e) && e.status === 401) {
                                      msgApi.warning("登录已过期，请重新登录");
                                      router.replace("/login");
                                      return;
                                    }
                                    msgApi.error(getApiErrorMessage(e) ?? "上架失败");
                                  } finally {
                                    setPublishingId(null);
                                  }
                                }}
                              >
                                上架
                              </Button>
                            ),
                            <Popconfirm
                              key="delete"
                              title="确认删除这篇文章？"
                              okText="删除"
                              cancelText="取消"
                              okButtonProps={{ danger: true }}
                              onConfirm={async () => {
                                try {
                                  await deleteJson(`/api/posts/${item.id}`, csrfToken);
                                  msgApi.success("已删除");
                                  const maxPage = Math.max(1, Math.ceil((listTotal - 1) / PAGE_SIZE));
                                  await refreshPosts(Math.min(page, maxPage));
                                } catch (e: unknown) {
                                  if (isThrownApiError(e) && e.status === 401) {
                                    msgApi.warning("登录已过期，请重新登录");
                                    router.replace("/login");
                                    return;
                                  }
                                  msgApi.error(getApiErrorMessage(e) ?? "删除失败");
                                }
                              }}
                            >
                              <Button size="small" danger>
                                删除
                              </Button>
                            </Popconfirm>,
                          ]
                        : undefined
                    }
                  >
                    <List.Item.Meta
                      title={
                        <Space orientation="vertical" size={4}>
                          <Space wrap align="center">
                            <Tag color={item.published ? "green" : "default"}>
                              {item.published ? "已发布" : "草稿"}
                            </Tag>
                            <Typography.Text strong>
                              {item.published ? (
                                <Link href={`/posts/${encodeURIComponent(item.slug)}`}>{item.title}</Link>
                              ) : (
                                item.title
                              )}
                            </Typography.Text>
                          </Space>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            作者：{item.author.name ?? item.author.email} · {new Date(item.createdAt).toLocaleString()}
                            {isMine(item) ? (
                              <>
                                {" "}
                                · slug：<Typography.Text code copyable>
                                  {item.slug}
                                </Typography.Text>
                              </>
                            ) : null}
                          </Typography.Text>
                        </Space>
                      }
                      description={
                        <Space orientation="vertical" size="small" className="w-full max-w-xl">
                          {item.coverImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.coverImage}
                              alt=""
                              style={{ maxHeight: 96, maxWidth: 240, borderRadius: 8, objectFit: "cover" }}
                              loading="lazy"
                            />
                          ) : null}
                          {item.excerpt ? (
                            <Typography.Text type="secondary">{item.excerpt}</Typography.Text>
                          ) : null}
                          {item.content ? (
                            <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
                              {item.content}
                            </Typography.Paragraph>
                          ) : null}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
              {listTotal > 0 ? (
                <Pagination
                  style={{ marginTop: 16, textAlign: "right" }}
                  current={page}
                  pageSize={PAGE_SIZE}
                  total={listTotal}
                  showSizeChanger={false}
                  showTotal={(t) => `共 ${t} 篇`}
                  onChange={(p) => void refreshPosts(p)}
                />
              ) : null}
            </Card>
          </Space>
        </div>
      </Layout.Content>

      <Modal
        title="编辑文章"
        open={!!editing}
        confirmLoading={savingEdit}
        okText="保存"
        cancelText="取消"
        onCancel={() => {
          setEditing(null);
          editForm.resetFields();
        }}
        onOk={async () => {
          try {
            const values = await editForm.validateFields();
            if (!editing) return;
            setSavingEdit(true);
            const patchBody: {
              title: string;
              content?: string;
              published: boolean;
              slug?: string;
              excerpt: string;
              coverImage: string;
            } = {
              title: values.title,
              content: values.content,
              published: values.published,
              excerpt: values.excerpt?.trim() ?? "",
              coverImage: values.coverImage?.trim() ?? "",
            };
            const nextSlug = values.slug?.trim().toLowerCase();
            if (nextSlug && nextSlug !== editing.slug) {
              patchBody.slug = nextSlug;
            }
            await patchJson(`/api/posts/${editing.id}`, patchBody, csrfToken);
            msgApi.success("已保存");
            setEditing(null);
            editForm.resetFields();
            await refreshPosts();
          } catch (e: unknown) {
            // validateFields 抛错时不提示
            if (typeof e === "object" && e !== null && "errorFields" in e) return;
            if (isThrownApiError(e) && e.status === 401) {
              msgApi.warning("登录已过期，请重新登录");
              router.replace("/login");
              return;
            }
            msgApi.error(getApiErrorMessage(e) ?? "保存失败");
          } finally {
            setSavingEdit(false);
          }
        }}
      >
        <Form form={editForm} layout="vertical" requiredMark={false}>
          <Form.Item label="标题" name="title" rules={[{ required: true, message: "请输入标题" }]}>
            <Input />
          </Form.Item>
          <Form.Item label="内容" name="content">
            <Input.TextArea autoSize={{ minRows: 3, maxRows: 8 }} />
          </Form.Item>
          <Form.Item label="摘要（excerpt）" name="excerpt" extra="留空保存会清空摘要。">
            <Input.TextArea maxLength={500} showCount rows={2} />
          </Form.Item>
          <Form.Item label="封面图" extra="留空保存会移除封面。">
            <CoverImageControls form={editForm} csrfToken={csrfToken} msgApi={msgApi} />
          </Form.Item>
          <Form.Item label="对外发布（读者可见）" name="published" valuePropName="checked">
            <Switch checkedChildren="已发布" unCheckedChildren="草稿" />
          </Form.Item>
          <Form.Item
            label="URL 片段（slug，可选）"
            name="slug"
            extra="留空表示不通过本字段修改；填写则须全局唯一（小写、数字、连字符）。仅改标题可不填，系统会按标题重算 slug。"
            rules={[
              {
                pattern: /^$|^[a-z0-9]+(?:-[a-z0-9]+)*$/,
                message: "仅小写字母、数字与连字符，或以空字符串跳过",
              },
            ]}
          >
            <Input placeholder="例如：my-first-post" allowClear />
          </Form.Item>
        </Form>
      </Modal>
    </Layout>
  );
}
