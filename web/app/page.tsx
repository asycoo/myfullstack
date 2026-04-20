"use client";

import Link from "next/link";
import { Button, Card, Space, Typography } from "antd";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <Card className="w-full max-w-xl">
        <Space direction="vertical" size="middle" className="w-full">
          <Typography.Title level={3} style={{ margin: 0 }}>
            全栈项目已跑通
          </Typography.Title>
          <Typography.Text type="secondary">
            现在你已经有：Next.js + Prisma + PostgreSQL + Cookie Session 登录鉴权。
          </Typography.Text>
          <Space>
            <Link href="/login">
              <Button type="primary">去登录 / 注册</Button>
            </Link>
            <Link href="/posts">
              <Button>去文章页</Button>
            </Link>
          </Space>
        </Space>
      </Card>
    </div>
  );
}
