# CSRF（Synchronizer Token）设计稿

**日期**：2026-04-20  
**范围**：第 5 步安全基线中的 CSRF 防护（方案 A：Synchronizer Token）  
**当前登录态**：`HttpOnly` 的 `session` cookie（`sameSite: "lax"`，`secure` 仅生产环境）  

---

## 目标与非目标

### 目标
- 对所有依赖 `session` cookie 的**写请求**（POST/PATCH/DELETE）增加 CSRF 防护。
- 防护机制与现有分层（route/service/repo）兼容，且能逐步覆盖更多写接口。
- 客户端（`web/app/posts/page.tsx`）能以**统一方式**附加 CSRF token（header）。

### 非目标（本次不做）
- 引入 Redis/缓存层来存 token（增加基础设施复杂度）。
- 全面重写前端网络层（只做最小、清晰、可复用的改动）。
- 对所有 GET 请求做 CSRF（GET 本应无副作用；只对写请求强制）。

---

## 威胁模型（我们要挡什么）

在 Cookie Session 模型下：
- 浏览器会在跨站请求中**自动携带 cookie**（受 SameSite 影响，但不能只依赖 SameSite）。
- 攻击者可在第三方站点诱导用户访问一个页面并触发对本站的写请求。

**要点**：攻击者无法读取本站响应、也无法读到 `HttpOnly` cookie；因此我们用一个“需要前端主动带上的 token”来区分**同源脚本发起**与**跨站诱导**。

---

## 总体方案（Synchronizer Token）

### 核心规则
- 服务端为每个已登录 session 生成并保存一个 `csrfToken`。
- 前端在每次写请求时，通过 header 携带 `x-csrf-token: <token>`。
- 服务端对比 header token 与 session 绑定 token：
  - 缺失或不匹配：拒绝请求（建议 403）。

### 为什么不用 Double Submit Cookie（本次）
- Double Submit 需要一个**非 HttpOnly** 的 cookie（可被 JS 读取），虽然可用但容易引发误用；而我们已有 session 表，直接把 token 存在 session 里更自然。

---

## 数据模型变更

### Prisma：`Session` 增加字段
- `Session.csrfToken String`
- 生成策略：创建 session 时生成随机 token（建议 `randomBytes(32).toString("hex")`）

**迁移影响**：
- 需要新增 migration。
- 既有 session 记录如果没有 token，需要兼容（例如：读到为空则拒绝写请求，并引导用户重新登录；或在读取时补写 token）。

推荐的兼容策略（最简单、最安全）：
- 只要 session 缺 `csrfToken`，写请求直接 403 + “请重新登录”（或更中性：“CSRF 校验失败”），并在登录后新建 session 会具备 token。

---

## API 设计

### 1) `GET /api/csrf`

**用途**：客户端获取当前登录态对应的 CSRF token，用于后续写请求。

**请求**：
- Method: `GET`
- Headers: 无特殊要求（浏览器会带 cookie）

**响应**（成功 200）：
- `ok({ token: string })`

**响应**（未登录 401）：
- `fail("UNAUTHORIZED", "未登录")`

### 2) 写接口校验（统一规则）

对以下接口（至少先覆盖）强制校验：
- `POST /api/posts`
- `PATCH /api/posts/:id`
- `DELETE /api/posts/:id`
- `POST /api/auth/logout`

校验输入：
- Header: `x-csrf-token`

失败响应（建议）：
- `fail("FORBIDDEN", "CSRF 校验失败")`

---

## 服务端实现设计（分层与落点）

### 新增模块建议
新增一个小模块负责 CSRF，不掺杂业务：
- `web/lib/csrf/csrf.service.ts`
  - `requireCsrf(request: Request): Promise<void>`：校验 header token 与当前 session 绑定 token 一致，否则抛出 `Response`（`fail(...)`）。
  - `getCsrfTokenForCurrentSession(): Promise<{ token: string }>`：供 `GET /api/csrf` route 使用。
- `web/lib/csrf/csrf.repo.ts`（如果需要）
  - 读取 session 的 `csrfToken`（沿用现有 `session.repo.ts` 也可以；取决于你是否希望保持 session repo 简洁）

### 校验依赖
CSRF 校验依赖：
- `getSessionIdFromCookie()`（已存在）
- `session.repo.findValidSessionWithUser()` 或新增 `findValidSession()`（避免每次 include user）

推荐优化（非必须，但结构更干净）：
- 在 `session.repo.ts` 增加一个方法，仅查 session：
  - `findValidSession(id: string, now: Date)` → `{ id, userId, expiresAt, csrfToken }`

### route handler 里怎么用
在每个写接口的 handler 顶部：
- 先 `await requireCsrf(request)`
- 再做 `requireUser()` / Zod / 调 service

这样能保证“未经 CSRF 校验的写请求”不会触达业务与数据库写入。

---

## 客户端接入（`web/app/posts/page.tsx`）

### 目标
- 最小改动：保持现在的 `getJson/postJson/patchJson/deleteJson` 风格。
- 统一注入：写请求自动带上 `x-csrf-token`。

### 方案
1. 页面初始化（已在 `useEffect` 里做了 `refreshMe()`）后：
   - 若已登录：额外请求一次 `GET /api/csrf`，把 token 缓存在内存变量（`useState` 或模块级变量都可）。
2. 修改 `postJson/patchJson/deleteJson`：
   - 在 headers 里加 `x-csrf-token`（如果 token 不存在则直接请求也会得到 403，用于暴露问题）。

---

## login/register 的处理（同源校验）

`login/register` 在“还没 session”时无法绑定 session token，因此本次不强制它们携带 CSRF token，避免引入“匿名 session”体系导致范围膨胀。

但为了降低登录 CSRF 风险（受害者被诱导登录到攻击者账号），建议增加一个轻量的同源校验：
- 校验 `Origin` header 是否为本站 origin（开发环境 `http://localhost:3000`，生产环境为你的域名）。
- 若缺 `Origin`：
  - 允许（兼容某些环境），或按更严格策略拒绝；本次建议：对浏览器请求通常都有 Origin，缺失时先允许但记录日志。

该校验也可复用到其它写接口（作为额外硬化），但本次主要靠 CSRF token。

---

## 错误码与可观测性

- CSRF 不通过：`FORBIDDEN`（403）
- 未登录：沿用 `UNAUTHORIZED`（401）
- 建议在服务端日志中记录：
  - endpoint、method、用户 id（若能拿到）、是否缺 token、是否不匹配（不要把 token 本体打日志）

---

## 测试策略（与现有 smoke 结合）

扩展 `web/scripts/smoke.mjs`：
- 登录后，先调用 `GET /api/csrf` 取 token。
- 写请求（发帖/改帖/删帖/退出）都带上 `x-csrf-token`，应通过。
- 增加一组“缺 token”用例：
  - 不带 `x-csrf-token` 调 `POST /api/posts`，应得到 403 且错误结构稳定。

---

## 迁移与上线注意事项

- 本地：跑 migration 后启动应用，确保新建 session 会写入 `csrfToken`。
- 线上：如果已有历史 session 数据：
  - token 为空的 session 将无法写操作；用户重新登录即可获得新 session + token（可接受的折中）。

