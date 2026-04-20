"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Form, Input, Tabs, Typography, message } from "antd";

type LoginValues = { email: string; password: string };
type RegisterValues = { email: string; password: string; name?: string };

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

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T;
  if (!res.ok) throw { status: res.status, data };
  return data;
}

export default function LoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);
  const [msgApi, contextHolder] = message.useMessage();

  const items = useMemo(
    () => [
      {
        key: "login",
        label: "登录",
        children: (
          <Form<LoginValues>
            layout="vertical"
            requiredMark={false}
            onFinish={async (values) => {
              setLoading(true);
              try {
                await postJson("/api/auth/login", values);
                msgApi.success("登录成功");
                router.replace("/posts");
              } catch (e: unknown) {
                msgApi.error(getApiErrorMessage(e) ?? "登录失败");
              } finally {
                setLoading(false);
              }
            }}
          >
            <Form.Item
              label="邮箱"
              name="email"
              rules={[{ required: true, message: "请输入邮箱" }, { type: "email", message: "邮箱格式不正确" }]}
            >
              <Input placeholder="you@example.com" autoComplete="email" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: "请输入密码" }]}
            >
              <Input.Password placeholder="至少 6 位" autoComplete="current-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form>
        ),
      },
      {
        key: "register",
        label: "注册",
        children: (
          <Form<RegisterValues>
            layout="vertical"
            requiredMark={false}
            onFinish={async (values) => {
              setLoading(true);
              try {
                await postJson("/api/auth/register", values);
                msgApi.success("注册成功（已自动登录）");
                router.replace("/posts");
              } catch (e: unknown) {
                msgApi.error(getApiErrorMessage(e) ?? "注册失败");
              } finally {
                setLoading(false);
              }
            }}
          >
            <Form.Item label="昵称" name="name">
              <Input placeholder="可选" autoComplete="nickname" />
            </Form.Item>
            <Form.Item
              label="邮箱"
              name="email"
              rules={[{ required: true, message: "请输入邮箱" }, { type: "email", message: "邮箱格式不正确" }]}
            >
              <Input placeholder="you@example.com" autoComplete="email" />
            </Form.Item>
            <Form.Item
              label="密码"
              name="password"
              rules={[
                { required: true, message: "请输入密码" },
                { min: 6, message: "至少 6 位" },
              ]}
            >
              <Input.Password placeholder="至少 6 位" autoComplete="new-password" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              注册并登录
            </Button>
          </Form>
        ),
      },
    ],
    [loading, msgApi, router]
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6">
      {contextHolder}
      <Card className="w-full max-w-md">
        <Typography.Title level={3} style={{ marginTop: 0 }}>
          欢迎
        </Typography.Title>
        <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
          登录后才能发帖。我们使用 Cookie + Session 存储登录态（HttpOnly，更安全）。
        </Typography.Paragraph>
        <Tabs
          activeKey={tab}
          onChange={(k) => setTab(k as "login" | "register")}
          items={items}
        />
      </Card>
    </div>
  );
}

