# CSRF（Synchronizer Token）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为所有依赖 `session` cookie 的写接口增加 CSRF 防护（方案A），并更新前端与 smoke 测试以保持可回归。

**Architecture:** 在 `Session` 表存 `csrfToken`，新增 `GET /api/csrf` 下发 token；写接口统一校验 `x-csrf-token` header 与当前 session token 匹配；对 `login/register` 增加 Origin 同源校验（不要求 token）。

**Tech Stack:** Next.js App Router route handlers, Prisma(Postgres), Zod, Node `crypto`, 现有 `web/scripts/smoke.mjs`

---

## 文件结构（将创建/修改哪些文件）

**Create**
- `web/lib/csrf/csrf.service.ts`
- `web/app/api/csrf/route.ts`

**Modify**
- `web/prisma/schema.prisma`
- `web/lib/session/session.repo.ts`
- `web/lib/session/session.service.ts`
- `web/lib/auth/auth.service.ts`
- `web/app/api/posts/route.ts`
- `web/app/api/posts/[id]/route.ts`
- `web/app/api/auth/logout/route.ts`
- `web/app/api/auth/login/route.ts`
- `web/app/api/auth/register/route.ts`
- `web/app/posts/page.tsx`
- `web/scripts/smoke.mjs`

**Verify**
- `cd web && npm run lint`
- `cd web && BASE_URL=http://localhost:3000 npm run test:smoke`

---

### Task 1: Prisma 增加 `Session.csrfToken`

**Files:**
- Modify: `web/prisma/schema.prisma`

- [ ] **Step 1: 更新 Prisma schema**

把 `Session` 模型改成包含 `csrfToken`：

```prisma
model Session {
  id        String   @id
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  csrfToken String
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}
```

- [ ] **Step 2: 生成并应用迁移**

运行：

```bash
cd web
npx prisma migrate dev -n add_csrf_token
```

预期：`prisma/migrations/*/migration.sql` 出现新增列的 SQL。

- [ ] **Step 3: 快速类型检查（可选但推荐）**

运行：

```bash
cd web
npm run lint
```

预期：无新增 lint 报错（或仅与本变更无关的既有问题）。

---

### Task 2: Session 层提供“带 csrfToken 的 session 查询”

**Files:**
- Modify: `web/lib/session/session.repo.ts`
- Modify: `web/lib/session/session.service.ts`

- [ ] **Step 1: 在 `session.repo.ts` 新增仅查询 session 的方法**

新增函数（示例签名，按现有风格导出）：

```ts
export async function findValidSession(id: string, now: Date) {
  return prisma.session.findFirst({
    where: { id, expiresAt: { gt: now } },
    select: { id: true, userId: true, expiresAt: true, csrfToken: true },
  });
}
```

- [ ] **Step 2: 让创建 session 时写入 csrfToken**

修改 `createSessionForUser`（位于 `web/lib/session/session.service.ts`）：
- 生成 `csrfToken = randomBytes(32).toString("hex")`
- `repo.createSession({ id, userId, expiresAt, csrfToken })`

预期：登录后新建的 session 记录具备 `csrfToken`。

---

### Task 3: 新增 CSRF service（校验与下发）

**Files:**
- Create: `web/lib/csrf/csrf.service.ts`

- [ ] **Step 1: 创建 `web/lib/csrf/csrf.service.ts`**

实现两个入口：
- `getCsrfTokenForCurrentSession()`：从 cookie 取 sessionId → 查有效 session → 返回 `{ token }`；未登录抛 `fail("UNAUTHORIZED", "未登录")`
- `requireCsrf(request: Request)`：读取 header `x-csrf-token`，与当前 session 的 `csrfToken` 对比；缺失或不匹配抛 `fail("FORBIDDEN", "CSRF 校验失败")`

要点：
- 依赖 `getSessionIdFromCookie()` 与 `session.repo.findValidSession()`
- 不要把 token 打到日志里

---

### Task 4: 新增 `GET /api/csrf`

**Files:**
- Create: `web/app/api/csrf/route.ts`

- [ ] **Step 1: 新增 route handler**

实现：
- `GET` 调用 `getCsrfTokenForCurrentSession()` 并 `ok({ token })`

---

### Task 5: 写接口接入 CSRF 校验（posts + logout）

**Files:**
- Modify: `web/app/api/posts/route.ts`
- Modify: `web/app/api/posts/[id]/route.ts`
- Modify: `web/app/api/auth/logout/route.ts`

- [ ] **Step 1: 在 `POST /api/posts` 开头调用 `requireCsrf(request)`**
- [ ] **Step 2: 在 `PATCH/DELETE /api/posts/:id` 开头调用 `requireCsrf(request)`**
- [ ] **Step 3: 在 `POST /api/auth/logout` 开头调用 `requireCsrf(request)`**

预期：
- 缺 `x-csrf-token` → 403（结构为 `{ data:null, error:{ code:"FORBIDDEN", ... } }`）
- token 正确 → 原逻辑行为不变

---

### Task 6: login/register 增加 Origin 同源校验（不要求 token）

**Files:**
- Modify: `web/app/api/auth/login/route.ts`
- Modify: `web/app/api/auth/register/route.ts`

- [ ] **Step 1: 在 login/register route 顶部加入 Origin 校验**

规则（开发环境先按 localhost）：
- 允许的 origin：`http://localhost:3000`
- 如果 `Origin` 存在且不匹配 → `fail("FORBIDDEN", "Origin 不被允许")`
- 如果 `Origin` 缺失：先放行（避免非浏览器客户端被误伤），但可 `console.warn`（不要打印敏感信息）

后续（部署阶段）再把允许 origin 变成环境变量配置。

---

### Task 7: 前端统一带 CSRF token header（Posts 页）

**Files:**
- Modify: `web/app/posts/page.tsx`

- [ ] **Step 1: 在登录后拉取 CSRF token**

在现有 `useEffect` 的登录判断之后（`current` 非空）：
- 请求 `GET /api/csrf`
- 缓存到 state：`const [csrfToken, setCsrfToken] = useState<string | null>(null);`

- [ ] **Step 2: 改造 `postJson/patchJson/deleteJson` 注入 header**

把 header 变成：
- 保留 `Content-Type`
- 追加 `x-csrf-token: csrfToken ?? ""`

（服务端会拒绝空 token；这样能让问题暴露得更早、更一致。）

---

### Task 8: 更新 smoke tests 覆盖 CSRF

**Files:**
- Modify: `web/scripts/smoke.mjs`

- [ ] **Step 1: 在 `request()` 增加可选 header 参数**

把签名扩展为：

```js
async function request(path, { method = "GET", json, cookie, headers: extraHeaders } = {}) {
  const headers = { ...(extraHeaders ?? {}) };
  if (json !== undefined) headers["Content-Type"] = "application/json";
  if (cookie) headers["Cookie"] = cookie;
  // ...
}
```

- [ ] **Step 2: 登录后获取 csrf token**

在已拿到 `cookieA` / `cookieA2` 的位置插入：

```js
const csrfA = await request("/api/csrf", { cookie: cookieA });
assert(csrfA.res.status === 200, `csrf A expected 200, got ${csrfA.res.status}`);
const tokenA = csrfA.body?.data?.token;
assert(typeof tokenA === "string" && tokenA.length > 0, `csrf token missing: ${JSON.stringify(csrfA.body)}`);
```

然后所有写请求都带：

```js
headers: { "x-csrf-token": tokenA }
```

- [ ] **Step 3: 增加“缺 token 403”断言**

例如在 create post 之前增加：

```js
const createNoCsrf = await request("/api/posts", {
  method: "POST",
  cookie: cookieA,
  json: { title: "no-csrf" },
});
assert(createNoCsrf.res.status === 403, `create without csrf should be 403, got ${createNoCsrf.res.status}`);
```

---

### Task 9: 回归验证

- [ ] **Step 1: 启动服务（若未启动）**

```bash
cd web
npm run dev
```

- [ ] **Step 2: 运行 lint**

```bash
cd web
npm run lint
```

- [ ] **Step 3: 运行 smoke**

```bash
cd web
BASE_URL=http://localhost:3000 npm run test:smoke
```

预期：输出 `✅ smoke tests passed`，并且包含“缺 token 403”的断言已覆盖。

