# Rate Limit（内存版 + 429）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为关键 API 增加内存版 rate limit，并在触发限流时返回统一结构 + HTTP 429。

**Architecture:** 新增 `ratelimit` 工具模块（Fixed Window + Map + 惰性过期清理），route handler 顶部调用 `rateLimitOrThrow`；新增 `ApiErrorCode.TOO_MANY_REQUESTS` 并映射到 429；扩展 smoke 覆盖 429。

**Tech Stack:** Next.js App Router route handlers, TypeScript, Zod, Node runtime

---

## 文件结构（将创建/修改哪些文件）

**Create**
- `web/lib/ratelimit/ratelimit.ts`
- `web/lib/ratelimit/ip.ts`

**Modify**
- `web/lib/api.ts`
- `web/app/api/auth/login/route.ts`
- `web/app/api/auth/register/route.ts`
- `web/app/api/posts/route.ts`
- `web/app/api/posts/[id]/route.ts`
- `web/scripts/smoke.mjs`

**Verify**
- `cd web && npm run lint`
- `cd web && BASE_URL=http://localhost:3000 npm run test:smoke`

---

### Task 1: API 错误码增加 429 映射

**Files:**
- Modify: `web/lib/api.ts`

- [ ] **Step 1: 在 `ApiErrorCode` 增加 `TOO_MANY_REQUESTS`**
- [ ] **Step 2: 在 `fail()` 的 code→status 映射中加入 429**

预期：
- `fail("TOO_MANY_REQUESTS", "...")` 返回 status 429，body 结构不变。

---

### Task 2: 新增 IP 解析工具

**Files:**
- Create: `web/lib/ratelimit/ip.ts`

- [ ] **Step 1: 实现 `getClientIp(request)`**

规则：
- 优先 `x-forwarded-for`（取逗号分隔第一个，trim）
- 再 `x-real-ip`
- fallback `"unknown"`

---

### Task 3: 新增内存 rate limit 模块（Fixed Window）

**Files:**
- Create: `web/lib/ratelimit/ratelimit.ts`

- [ ] **Step 1: 实现 `rateLimitOrThrow({ key, limit, windowMs })`**

要求：
- 内部用 `Map<string, { count: number; resetAt: number }>`
- 每次调用先惰性删除 `resetAt <= now` 的当前 key 记录
- 计算当前窗口 `resetAt = windowStart + windowMs`
- 计数 +1，若 `count > limit` 则 `throw fail("TOO_MANY_REQUESTS", "请求过于频繁，请稍后再试")`

---

### Task 4: 接入 login/register

**Files:**
- Modify: `web/app/api/auth/login/route.ts`
- Modify: `web/app/api/auth/register/route.ts`

- [ ] **Step 1: login：在解析 body 前执行限流**

key：`login:${ip}:${email}`  
建议阈值：`limit=5, windowMs=60_000`

注意：email 需要从 body 里取；为避免“解析 body 太贵”，本次允许先解析（已是 JSON 小对象）。

- [ ] **Step 2: register：在解析 body 前执行限流**

key：`register:${ip}`  
阈值：`limit=3, windowMs=60_000`

顺序：rate limit → Origin 校验 → Zod → service

---

### Task 5: 接入 posts 写接口

**Files:**
- Modify: `web/app/api/posts/route.ts`
- Modify: `web/app/api/posts/[id]/route.ts`

- [ ] **Step 1: POST /api/posts**

顺序：rate limit（基于 userId）→ CSRF → requireUser → Zod → service  
key：`post:create:${userId}`  
阈值：`limit=30, windowMs=60_000`

- [ ] **Step 2: PATCH/DELETE /api/posts/:id**

key：`post:mutate:${userId}`  
阈值：`limit=60, windowMs=60_000`

---

### Task 6: 扩展 smoke 覆盖 429

**Files:**
- Modify: `web/scripts/smoke.mjs`

- [ ] **Step 1: 对 `/api/auth/login` 做 6 次错误密码尝试**

预期：至少一次返回 429；其他可为 401。

- [ ] **Step 2: 对 `/api/auth/register` 快速多次调用**

预期：至少一次返回 429（注意每次 email 不同，主要看按 IP 限流）。

---

### Task 7: 回归验证

- [ ] **Step 1: `npm run lint`**
- [ ] **Step 2: `npm run test:smoke`（确保 dev server 在跑）**

