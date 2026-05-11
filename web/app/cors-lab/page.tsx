"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Divider, Form, Input, Space, Switch, Typography, message } from "antd";

type Result =
  | { kind: "ok"; status: number; body: unknown; note?: string }
  | { kind: "error"; message: string; note?: string };

const DEFAULT_BASE = "http://localhost:4000";

async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

export default function CorsLabPage() {
  const [msgApi, holder] = message.useMessage();
  const [base, setBase] = useState(DEFAULT_BASE);
  const [includeCreds, setIncludeCreds] = useState(true);
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchInit = useMemo<RequestInit>(() => {
    const init: RequestInit = {};
    if (includeCreds) init.credentials = "include";
    return init;
  }, [includeCreds]);

  async function run(label: string, fn: () => Promise<void>) {
    setLoading(true);
    setResult(null);
    try {
      await fn();
      msgApi.success(label);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setResult({ kind: "error", message: msg, note: label });
      msgApi.error(`${label}：${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-6">
      {holder}
      <div className="mx-auto w-full max-w-3xl">
        <Space orientation="vertical" size="large" className="w-full">
          <Card>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Typography.Title level={3} style={{ margin: 0 }}>
                CORS 实验室
              </Typography.Title>
              <Link href="/">
                <Button>回首页</Button>
              </Link>
            </Space>
            <Typography.Paragraph type="secondary" style={{ marginTop: 8 }}>
              这个页面从 <Typography.Text code>localhost:3000</Typography.Text> 发请求到{" "}
              <Typography.Text code>localhost:4000</Typography.Text>，用来亲手观察：
              <Typography.Text strong> CORS / 预检 OPTIONS / Cookie(credentials)</Typography.Text> 的行为。
            </Typography.Paragraph>
            <Divider />

            <Form layout="vertical" requiredMark={false}>
              <Form.Item label="后端 Base URL（cors-lab server）">
                <Input value={base} onChange={(e) => setBase(e.target.value)} />
              </Form.Item>
              <Form.Item label='fetch 是否带上 credentials: "include"'>
                <Space>
                  <Switch checked={includeCreds} onChange={setIncludeCreds} />
                  <Typography.Text type="secondary">
                    {includeCreds ? "带 Cookie（跨域时必须）" : "不带 Cookie"}
                  </Typography.Text>
                </Space>
              </Form.Item>
            </Form>

            <Divider />

            <Space wrap>
              <Button
                loading={loading}
                onClick={() =>
                  run("读取 /config", async () => {
                    const res = await fetch(`${base}/config`, fetchInit);
                    setResult({ kind: "ok", status: res.status, body: await safeJson(res) });
                  })
                }
              >
                GET /config
              </Button>

              <Button
                type="primary"
                loading={loading}
                onClick={() =>
                  run("登录（Set-Cookie）", async () => {
                    const res = await fetch(`${base}/login`, { ...fetchInit, method: "POST" });
                    setResult({
                      kind: "ok",
                      status: res.status,
                      body: await safeJson(res),
                      note:
                        "注意：跨域想写入 cookie，需要 server 允许 credentials，并且 Allow-Origin 不能是 *",
                    });
                  })
                }
              >
                POST /login（Set-Cookie）
              </Button>

              <Button
                loading={loading}
                onClick={() =>
                  run("读取 /me（需要 Cookie）", async () => {
                    const res = await fetch(`${base}/me`, fetchInit);
                    setResult({ kind: "ok", status: res.status, body: await safeJson(res) });
                  })
                }
              >
                GET /me
              </Button>

              <Button
                loading={loading}
                onClick={() =>
                  run("PATCH（触发预检）", async () => {
                    const res = await fetch(`${base}/posts/1`, {
                      ...fetchInit,
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ title: "patched" }),
                    });
                    setResult({
                      kind: "ok",
                      status: res.status,
                      body: await safeJson(res),
                      note: "PATCH + JSON 会触发浏览器 OPTIONS 预检；如果 server 不处理 OPTIONS 就会失败。",
                    });
                  })
                }
              >
                PATCH /posts/1（预检）
              </Button>

              <Button
                danger
                loading={loading}
                onClick={() =>
                  run("DELETE（通常也触发预检）", async () => {
                    const res = await fetch(`${base}/posts/1`, { ...fetchInit, method: "DELETE" });
                    setResult({ kind: "ok", status: res.status, body: await safeJson(res) });
                  })
                }
              >
                DELETE /posts/1
              </Button>
            </Space>
          </Card>

          <Card title="结果">
            <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
              如果你看到浏览器控制台报 CORS 错误，但这里显示的是{" "}
              <Typography.Text code>TypeError: Failed to fetch</Typography.Text>，那就是被 CORS 拦了（响应不会交给 JS）。
            </Typography.Paragraph>
            <pre className="whitespace-pre-wrap break-words text-xs leading-5 bg-zinc-900 text-zinc-100 p-4 rounded">
              {result ? JSON.stringify(result, null, 2) : "（还没有请求）"}
            </pre>
          </Card>
        </Space>
      </div>
    </div>
  );
}

