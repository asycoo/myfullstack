"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Form, Input, Tabs, Typography, message } from "antd";

type LoginValues = { email: string; password: string; captchaAnswer?: string };
type RegisterValues = { email: string; password: string; name?: string };

type CaptchaState =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "ready"; captchaId: string; question: string }
  | { status: "error"; message: string };

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
  const [captcha, setCaptcha] = useState<CaptchaState>({ status: "loading" });
  const [loginForm] = Form.useForm<LoginValues>();

  const loadCaptcha = useCallback(async () => {
    setCaptcha({ status: "loading" });
    try {
      const res = await fetch("/api/auth/captcha", { credentials: "include" });
      const json = (await res.json()) as {
        data?: { disabled?: boolean; captchaId?: string; question?: string };
        error?: { message?: string };
      };
      if (!res.ok) {
        setCaptcha({ status: "error", message: json?.error?.message ?? "获取验证码失败" });
        return;
      }
      const d = json.data;
      if (!d) {
        setCaptcha({ status: "error", message: "响应无效" });
        return;
      }
      if (d.disabled) {
        setCaptcha({ status: "disabled" });
        return;
      }
      if (d.captchaId && d.question) {
        setCaptcha({ status: "ready", captchaId: d.captchaId, question: d.question });
        loginForm.setFieldValue("captchaAnswer", undefined);
      } else {
        setCaptcha({ status: "error", message: "验证码数据不完整" });
      }
    } catch {
      setCaptcha({ status: "error", message: "网络错误" });
    }
  }, [loginForm]);

  useEffect(() => {
    if (tab === "login") {
      void loadCaptcha();
    }
  }, [tab, loadCaptcha]);

  const items = useMemo(
    () => [
      {
        key: "login",
        label: "登录",
        children: (
          <Form<LoginValues>
            form={loginForm}
            layout="vertical"
            requiredMark={false}
            onFinish={async (values) => {
              setLoading(true);
              try {
                const body: Record<string, string> = {
                  email: values.email,
                  password: values.password,
                };
                if (captcha.status === "ready") {
                  body.captchaId = captcha.captchaId;
                  const ans = values.captchaAnswer?.trim() ?? "";
                  if (!ans) {
                    msgApi.warning("请填写验证码");
                    setLoading(false);
                    return;
                  }
                  body.captchaAnswer = ans;
                }

                await postJson("/api/auth/login", body);
                msgApi.success("登录成功");
                router.replace("/posts/manage");
              } catch (e: unknown) {
                msgApi.error(getApiErrorMessage(e) ?? "登录失败");
                if (captcha.status === "ready" || captcha.status === "error") {
                  void loadCaptcha();
                }
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
            {captcha.status === "loading" ? (
              <Typography.Text type="secondary">验证码加载中…</Typography.Text>
            ) : null}
            {captcha.status === "disabled" ? (
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                未配置 <code className="rounded bg-zinc-100 px-1 text-xs">REDIS_URL</code> 时跳过验证码（仅开发便利；生产建议启用
                Redis）。
              </Typography.Paragraph>
            ) : null}
            {captcha.status === "ready" ? (
              <>
                <Typography.Text type="secondary">
                  验证码：<strong className="text-zinc-800">{captcha.question}</strong>
                </Typography.Text>
                <Form.Item
                  label="答案（数字）"
                  name="captchaAnswer"
                  rules={[{ required: true, message: "请输入计算结果" }]}
                  style={{ marginTop: 8 }}
                >
                  <Input placeholder="例如：12" inputMode="numeric" autoComplete="off" />
                </Form.Item>
                <Button type="link" htmlType="button" size="small" style={{ padding: 0 }} onClick={() => void loadCaptcha()}>
                  换一题
                </Button>
              </>
            ) : null}
            {captcha.status === "error" ? (
              <div className="mb-3 flex flex-col gap-2">
                <Typography.Text type="danger">{captcha.message}</Typography.Text>
                <Button size="small" onClick={() => void loadCaptcha()}>
                  重试验证码
                </Button>
              </div>
            ) : null}
            <Button type="primary" htmlType="submit" block loading={loading} style={{ marginTop: 12 }}>
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
                router.replace("/posts/manage");
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
    [captcha, loadCaptcha, loading, loginForm, msgApi, router],
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
          {` `}
          配置 <code className="rounded bg-zinc-100 px-1 text-xs">REDIS_URL</code> 后登录需算术验证码。
        </Typography.Paragraph>
        <p className="mb-4 text-sm">
          <Link href="/labs" className="text-blue-600 hover:underline">
            实验室 /labs
          </Link>
        </p>
        <Tabs activeKey={tab} onChange={(k) => setTab(k as "login" | "register")} items={items} />
      </Card>
    </div>
  );
}
