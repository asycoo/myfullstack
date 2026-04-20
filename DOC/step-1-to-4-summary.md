# 当前进度总结（第 1 步 ~ 第 4 步）

这份文档用于回顾你目前在项目里已经“真正落地”的后端能力，方便之后继续做第 5~7 步时随时对照。

项目位置：`my-fullstack-app/web`  
数据库：PostgreSQL（Docker） + Prisma

---

## 第 1 步：输入校验（Zod）+ 统一 API 返回格式

### 你学到/建立的能力
- **输入校验**：在接口入口处校验请求体，拒绝脏数据进入业务和数据库
- **统一响应**：前端永远可以用同一种方式处理成功/失败
- **错误码心智模型**：400/401/403/404/409/500 的职责边界

### 关键落地
- 统一返回结构：
  - 成功：`{ data: T, error: null }`
  - 失败：`{ data: null, error: { code, message, details? } }`

### 关键文件
- `web/lib/api.ts`
  - `ok()`：成功响应
  - `fail()`：失败响应（含 code→status 映射）
  - `failZod()`：Zod 校验失败统一输出
- 已接入统一格式与 Zod 校验的接口（示例）：
  - `web/app/api/auth/login/route.ts`
  - `web/app/api/auth/register/route.ts`
  - `web/app/api/posts/route.ts`
  - `web/app/api/me/route.ts`
  - `web/app/api/auth/logout/route.ts`

### 如何验证
- 用浏览器访问 `GET /api/me` 看结构是否稳定
- 随便传错参数（例如登录不传 email），应返回 `error.code = BAD_REQUEST`

---

## 第 2 步：授权（AuthZ）与资源所有权（作者才能改/删）

### 你学到/建立的能力
- **401 vs 403** 的区别：
  - 401：你是谁都不知道（未登录）
  - 403：知道你是谁，但你无权操作该资源
- **资源所有权校验**：典型后端业务规则（作者才能改/删）
- **动态路由参数**：`app/api/posts/[id]/route.ts` 的 `ctx.params`

### 关键落地
- 新增接口：
  - `PATCH /api/posts/:id`
  - `DELETE /api/posts/:id`
- 返回行为：
  - 未登录：401
  - 非作者：403
  - 文章不存在：404

### 关键文件
- 后端：
  - `web/app/api/posts/[id]/route.ts`
- 前端（仅对自己文章显示编辑/删除按钮）：
  - `web/app/posts/page.tsx`

### 如何验证
- A 用户创建文章
- B 用户尝试 PATCH/DELETE A 的文章 → 403
- 未登录直接 POST/PATCH/DELETE → 401

---

## 第 3 步：分层（route / service / repo）

### 你学到/建立的能力
- **route handler**：只做 HTTP（解析、校验、返回）
- **service**：只做业务规则（是否作者、是否存在、调用 repo）
- **repo**：只做数据访问（Prisma 查询细节）

### 关键落地（posts 已分层）
- repo：`web/lib/posts/posts.repo.ts`
- service：`web/lib/posts/posts.service.ts`
- route：
  - `web/app/api/posts/route.ts`
  - `web/app/api/posts/[id]/route.ts`

### 额外落地（auth/me/session 也已按同一思路分层）
- cookie：`web/lib/session/session.cookies.ts`
- session repo/service：
  - `web/lib/session/session.repo.ts`
  - `web/lib/session/session.service.ts`
- auth repo/service/schema：
  - `web/lib/auth/auth.repo.ts`
  - `web/lib/auth/auth.service.ts`
  - `web/lib/auth/auth.schemas.ts`
- 兼容出口：
  - `web/lib/auth.ts`（对外继续提供 `requireUser/getCurrentUser/...`）

### 如何验证
- 重点是“行为不变”：注册/登录/发帖/编辑/删除/退出全流程跑通即可
- `npm run lint` 应通过（确保重构没有引入类型/规则问题）

---

## 第 4 步：测试（脚本式 smoke tests）

### 你学到/建立的能力
- 把“手动点点点回归”变成“可重复、可自动跑的回归”
- 覆盖最重要的后端链路：注册/登录态/权限/资源改删

### 关键落地
- 新增 smoke 测试脚本（无需测试框架）：
  - `web/scripts/smoke.mjs`
- package.json 脚本：
  - `web/package.json` → `test:smoke`

### 如何运行
前置：`npm run dev` 已在跑（默认 `http://localhost:3000`）

```bash
cd web
BASE_URL=http://localhost:3000 npm run test:smoke
```

预期输出：`✅ smoke tests passed`

---

## 下一步（第 5 步预告）
第 5 步开始进入后端“安全基线”，建议顺序：
- CSRF（Cookie Session 必学）
- rate limit（登录/写接口限流）
- 密码策略（强度规则）
- 日志脱敏（避免敏感信息落日志）

