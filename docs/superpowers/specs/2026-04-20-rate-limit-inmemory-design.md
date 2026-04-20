# Rate Limit（内存版 + 429）设计稿

**日期**：2026-04-20  
**范围**：第 5 步安全基线中的 rate limit（先做内存版，便于学习与快速落地）  
**适用对象**：Next.js App Router Route Handlers（`web/app/api/**/route.ts`）  

---

## 目标与非目标

### 目标
- 为关键接口增加 **rate limit**，降低爆破登录、刷注册、刷写接口风险。
- 当触发限流时，返回统一响应结构，并使用 **HTTP 429**。
- 实现方式可在未来平滑替换为 Redis（不改调用点/错误码语义）。

### 非目标（本次不做）
- 分布式/多实例一致性（内存实现天然做不到）。
- 精确到滑动窗口/令牌桶（先用 Fixed Window，足够学习与本地验证）。
- 全站所有接口都限流（先覆盖最关键入口，后续逐步扩展）。

---

## 实现方案概述

### 方案：Fixed Window + 内存 Map
- 以固定窗口（例如 60 秒）为单位计数。
- key 由“接口用途 + 身份维度（IP、email、userId）”拼接。
- 每次请求：
  - 计算当前窗口起点 `windowStart = floor(now / windowMs) * windowMs`
  - 读取计数并 +1
  - 超过 `limit` → 拒绝（429）

### 内存清理策略
为避免 `Map` 无限增长：
- 每条记录存 `resetAt`（窗口结束时间）
- 每次访问时顺便删除已过期的记录（惰性清理）
- 可选：每 N 次调用进行一次轻量全表清理（本次可不做，先惰性清理足够）

---

## 错误码与响应

### 新增错误码
在 `web/lib/api.ts` 的 `ApiErrorCode` 增加：
- `TOO_MANY_REQUESTS`

并在 `fail()` 的 code→status 映射中新增：
- `TOO_MANY_REQUESTS` → 429

### 返回体
触发限流统一返回：
- `fail("TOO_MANY_REQUESTS", "请求过于频繁，请稍后再试")`

（可选扩展：`details` 填 `resetAt`/`retryAfterSeconds`；本次先不强制。）

---

## Key 设计与限流策略（第一批覆盖）

### 获取客户端 IP
优先顺序：
1. `x-forwarded-for`（取第一个 IP）
2. `x-real-ip`
3. fallback：`"unknown"`

> 说明：本地开发多数场景足够；部署时再补齐可信代理链/更严格解析。

### 具体接口与阈值（建议默认值）

#### 1) 登录：`POST /api/auth/login`
- **目的**：防爆破（密码尝试）
- **key**：`login:${ip}:${email}`
- **limit/window**：5 次 / 60 秒（建议值）

#### 2) 注册：`POST /api/auth/register`
- **目的**：防刷号/防注册轰炸
- **key**：`register:${ip}`
- **limit/window**：3 次 / 60 秒（建议值）

#### 3) 发帖：`POST /api/posts`
- **目的**：防刷写
- **key**：`post:create:${userId}`（需要已登录）
- **limit/window**：30 次 / 60 秒（建议值）

#### 4) 改/删：`PATCH/DELETE /api/posts/:id`
- **目的**：防刷写
- **key**：`post:mutate:${userId}`
- **limit/window**：60 次 / 60 秒（建议值）

---

## 代码组织（推荐模块边界）

新增独立模块，避免把限流逻辑散落在各个 route handler：
- `web/lib/ratelimit/ratelimit.ts`
  - `rateLimitOrThrow({ key, limit, windowMs, now? })`
    - 超限：`throw fail("TOO_MANY_REQUESTS", "...")`
    - 未超限：返回 `{ remaining, resetAt }`（可选）
- `web/lib/ratelimit/ip.ts`
  - `getClientIp(request: Request): string`

Route 接入方式（统一风格）：
- 在每个 handler 顶部调用 `rateLimitOrThrow(...)`
- 之后再做 `Origin` 校验 / CSRF / `requireUser()` / Zod / service

推荐的校验顺序（从最便宜到最贵）：
1. rate limit
2. Origin（login/register）
3. CSRF（写接口）
4. requireUser（需要登录的接口）
5. 解析/校验 body（Zod）
6. 业务逻辑/数据库

---

## 测试策略

### Smoke tests 扩展（脚本式）
在 `web/scripts/smoke.mjs` 增加一组限流断言：
- 对 `/api/auth/login` 发送超过阈值的请求，期望至少一次返回 429
- 对 `/api/auth/register`（或构造多次 register）验证 429

> 注意：Fixed Window 可能受时间窗口影响，测试时用“多次快速请求”更稳定。

---

## 风险与后续演进

- **多实例不一致**：线上多副本时内存限流不可靠；部署阶段切 Redis 即可。
- **NAT 误伤**：同一公网 IP 下多个用户可能共享配额；后续可引入 `userId` 维度（已登录）与更细粒度策略。
- **更平滑算法**：未来可用滑动窗口/令牌桶替换实现，但对外 API 不变。

