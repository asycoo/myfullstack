# 密码策略（基础档）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 注册时强制密码长度 >= 8，并拒绝常见弱密码黑名单；保持统一错误结构（400 + BAD_REQUEST）。

**Architecture:** 新增 `password.policy.ts` 维护弱密码集合与归一化；`RegisterSchema.superRefine` 调用该策略；可选扩展 smoke 覆盖弱密码注册失败。

**Tech Stack:** Zod, Next.js route handlers, 现有 `failZod` / 统一响应结构

---

## 文件结构

**Create**
- `web/lib/auth/password.policy.ts`

**Modify**
- `web/lib/auth/auth.schemas.ts`
- `web/scripts/smoke.mjs`（可选）

**Verify**
- `cd web && npm run lint`
- `cd web && BASE_URL=http://localhost:3000 npm run test:smoke`

---

### Task 1: 新增弱密码策略模块

**Files:**
- Create: `web/lib/auth/password.policy.ts`

- [ ] **Step 1: 实现归一化与黑名单集合**

要求：
- `normalizePassword(pw)`：`pw.trim().toLowerCase()`
- `isWeakPassword(pw)`：对 normalize 后做 Set 精确匹配
- 黑名单最少包含：`12345678`、`password`、`qwerty`、`11111111`、`00000000`、`abcdefgh`

---

### Task 2: RegisterSchema 接入密码策略

**Files:**
- Modify: `web/lib/auth/auth.schemas.ts`

- [ ] **Step 1: 把 `RegisterSchema.password` 最小长度改为 8**
- [ ] **Step 2: 用 `superRefine` 拒绝弱密码**

要求：
- 弱密码时对 `password` 字段添加 issue（message 可用“密码过于简单”）

---

### Task 3: 扩展 smoke（推荐）

**Files:**
- Modify: `web/scripts/smoke.mjs`

- [ ] **Step 1: 增加弱密码注册用例**

示例：
- 调用 `/api/auth/register`，password=`12345678`
- 期望 status 400，且 `body.error.code === "BAD_REQUEST"`

---

### Task 4: 回归验证

- [ ] **Step 1: `npm run lint`**
- [ ] **Step 2: `npm run test:smoke`（确保 dev server 在跑）**

