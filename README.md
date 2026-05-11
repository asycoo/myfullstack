# My Fullstack App

一个用于学习的最小全栈项目：Next.js（App Router）+ Prisma + PostgreSQL。

## 本地开发

### 1) 启动 PostgreSQL（Docker）

```bash
cd my-fullstack-app
docker compose up -d
```

### 2) 配置环境变量

在 `my-fullstack-app/web/.env` 配置：

```ini
DATABASE_URL="postgresql://myapp:myapp_dev_password@localhost:5432/myapp_dev?schema=public"
ALLOWED_ORIGINS="http://localhost:3000"
```

### 3) 安装依赖与迁移

```bash
cd my-fullstack-app/web
npm install
npx prisma migrate dev
```

### 4) 启动开发服务器

```bash
cd my-fullstack-app/web
npm run dev
```

### 5) 运行 smoke tests

确保 `npm run dev` 正在运行，然后：

```bash
cd my-fullstack-app/web
BASE_URL=http://localhost:3000 npm run test:smoke
```

预期：`✅ smoke tests passed`

---

## 部署（Vercel + Neon Postgres，免费套餐）

### 1) 创建 Neon 数据库

在 Neon 控制台创建一个 Postgres 数据库，拿到连接串（`DATABASE_URL`）。

### 2) 在 Vercel 导入项目

导入仓库后，在 Vercel 的 Project Settings：
- **Root Directory**：选择 `my-fullstack-app/web`
- **Node.js 版本**：使用 Node `20+`（项目要求 `>=20.9.0`）

### 3) 配置环境变量（Production）

在 Vercel 设置：
- `DATABASE_URL`: Neon 提供的连接串
- `ALLOWED_ORIGINS`: 你的线上域名（例如 `https://<project>.vercel.app`）

### 4) 迁移与构建

本项目已将 `build` 脚本配置为：
- `prisma migrate deploy`
- `prisma generate`
- `next build`

因此只要环境变量正确，Vercel 构建时会自动跑迁移并生成 Prisma Client。

### 5) 上线后验证

你可以在浏览器打开：
- `/api/health`
- `/login` → 注册/登录 → `/posts` 的增删改查链路

