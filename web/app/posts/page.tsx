"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  Form,
  Input,
  Layout,
  List,
  Modal,
  Popconfirm,
  Space,
  Typography,
  message,
} from "antd";

type SafeUser = { id: number; email: string; name: string | null } | null;
type PostItem = {
  id: number;
  title: string;
  content: string | null;
  published: boolean;
  createdAt: string;
  author: { id: number; email: string; name: string | null };
};

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

export default function PostsPage() {
  const router = useRouter();
  const [msgApi, contextHolder] = message.useMessage();

  const [me, setMe] = useState<SafeUser>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editing, setEditing] = useState<PostItem | null>(null);
  const [editForm] = Form.useForm<{ title: string; content?: string }>();

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

  async function refreshPosts() {
    setLoadingPosts(true);
    try {
      const res = await getJson<{ data: PostItem[] }>("/api/posts");
      setPosts(res.data);
    } finally {
      setLoadingPosts(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const current = await refreshMe();
        if (!current) {
          router.replace("/login");
          return;
        }
        const csrf = await getJson<{ data: { token: string } }>("/api/csrf");
        setCsrfToken(csrf.data.token);
        await refreshPosts();
      } catch (e: unknown) {
        msgApi.error(getApiErrorMessage(e) ?? "加载失败");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isMine = (item: PostItem) => !!me && item.author.id === me.id;

  return (
    <Layout style={{ minHeight: "100vh" }}>
      {contextHolder}
      <Layout.Header style={{ display: "flex", alignItems: "center" }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }}>
          <Space>
            <Typography.Text style={{ color: "white" }}>My Fullstack App</Typography.Text>
            <Link href="/">
              <Button size="small">首页</Button>
            </Link>
          </Space>
          <Space>
            <Typography.Text style={{ color: "rgba(255,255,255,0.85)" }}>
              {loadingMe ? "加载中…" : meLabel}
            </Typography.Text>
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
          <Space direction="vertical" size="large" className="w-full">
            <Card title="发布新文章">
              <Form
                layout="vertical"
                requiredMark={false}
                onFinish={async (values: { title: string; content?: string }) => {
                  setCreating(true);
                  try {
                    await postJson("/api/posts", values, csrfToken);
                    msgApi.success("发布成功");
                    await refreshPosts();
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
                <Button type="primary" htmlType="submit" loading={creating}>
                  发布
                </Button>
              </Form>
            </Card>

            <Card
              title="文章列表"
              extra={
                <Button onClick={refreshPosts} loading={loadingPosts}>
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
                                });
                              }}
                            >
                              编辑
                            </Button>,
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
                                  await refreshPosts();
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
                        <Space direction="vertical" size={0}>
                          <Typography.Text strong>{item.title}</Typography.Text>
                          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            作者：{item.author.name ?? item.author.email} · {new Date(item.createdAt).toLocaleString()}
                          </Typography.Text>
                        </Space>
                      }
                      description={item.content ? <Typography.Paragraph>{item.content}</Typography.Paragraph> : null}
                    />
                  </List.Item>
                )}
              />
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
            await patchJson(`/api/posts/${editing.id}`, values, csrfToken);
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
        </Form>
      </Modal>
    </Layout>
  );
}

