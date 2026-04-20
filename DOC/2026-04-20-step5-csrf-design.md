## 第 5 步安全基线：CSRF（方案A：Synchronizer Token）设计说明

适用项目：`my-fullstack-app/web`（Next.js App Router + Prisma + Postgres），登录态使用 `HttpOnly` 的 `session` cookie（`sameSite=lax`）。

### 目标

- **防护目标**：防止已登录用户在第三方站点诱导下，被浏览器自动携带 cookie 发起“有副作用请求”（CSRF）。
- **覆盖范围**：所有写接口（至少 `POST/PATCH/DELETE`），以及 `POST /api/auth/logout`。
- **保持不变**：不改变现有 session cookie 登录态；继续使用统一响应格式 `{ data, error }` 与现有 `fail()` 错误码体系。

### 威胁模型与边界

- Cookie Session 会被浏览器在跨站请求中自动携带（`sameSite=lax` 只能降低部分风险），因此需要对“写请求”引入额外校验。
- 方案A不依赖 `Referer`/`Origin` 的稳定性（仍可作为附加检查，但不作为唯一防护）。

### 方案概述（Synchronizer Token）

#### 核心思路

- 每个 session 在服务端都有一个随机 `csrfToken`，与 session 强绑定。
- 前端通过只读接口获取 token，并在所有写请求中通过 header 显式携带。
- 服务端校验 header token 是否与当前 session 的 token 一致，不一致则拒绝。

### 数据模型变更

在 `Session` 模型上新增字段：

- `csrfToken String`

约束建议：

- 随机、不可预测（例如 32 bytes 随机数编码为 hex/base64url）
- 与 session 生命周期一致；登出或 session 失效后 token 同步失效

### API 设计

#### 1) 获取 CSRF Token

- **路由**：`GET /api/csrf`
- **鉴权**：必须登录（可复用 `requireUser()` 或等价逻辑）
- **返回**：
  - 成功：`{ data: { token: string }, error: null }`
  - 未登录：401（`error.code = UNAUTHORIZED`）
  - session 无效：401（同上）
- **缓存**：禁止缓存（避免跨用户/跨会话混淆）

#### 2) 写接口校验规范

所有写接口必须携带 header：

- `x-csrf-token: <token>`

服务端校验：

1. 从 cookie 获取 `sessionId`
2. 查找有效 session（未过期）
3. 比对 `request.headers.get("x-csrf-token") === session.csrfToken`

不通过的返回：

- **缺 token / token 不匹配**：403（`error.code = FORBIDDEN`，message: `CSRF 校验失败`）
- **未登录 / session 无效**：401（沿用现有语义）

### 前端接入约定

- 在需要发起写请求前，先调用 `GET /api/csrf` 获取 token，并缓存在内存中（React state / module-level 变量均可）。
- 所有写请求的 `fetch` 统一加 header `x-csrf-token`。
- 如果写请求返回 403 且 message 为 CSRF 相关，前端可尝试重新拉取一次 token 后重试一次（是否做自动重试由实现阶段决定）。

### 测试与验收（最小回归）

扩展现有 `web/scripts/smoke.mjs`（或新增一个小段测试）覆盖：

- **用正确登录态但不带 `x-csrf-token`** 调用任一写接口（例如 `POST /api/posts`）→ 预期 403
- **先 `GET /api/csrf` 拿 token，再带 header 写接口** → 预期成功

### 实施顺序（实现阶段）

- 先做 Prisma 迁移：`Session.csrfToken`
- session 创建时写入 csrfToken
- 增加 `GET /api/csrf`
- 给写接口加统一校验（优先 posts 与 logout，再覆盖其它写接口）
- 更新 smoke tests

