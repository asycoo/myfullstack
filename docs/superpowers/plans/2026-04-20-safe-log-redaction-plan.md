# 日志脱敏（safeLog）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入 `safeLog` 工具并在服务端错误路径使用，确保敏感信息不会落日志。

**Architecture:** `safe-log.ts` 负责递归脱敏并输出结构化 JSON；route handler catch 中用 `safeError` 替换 `console.error`。

**Tech Stack:** TypeScript, Next.js route handlers

---

## 文件结构

**Create**
- `web/lib/log/safe-log.ts`

**Modify**
- `web/app/api/auth/register/route.ts`

**Verify**
- `cd web && npm run lint`
- （可选）`cd web && BASE_URL=http://localhost:3000 npm run test:smoke`

---

### Task 1: 实现 `safeLog`

**Files:**
- Create: `web/lib/log/safe-log.ts`

- [ ] **Step 1: 实现 `redact(value)`（递归、限深度、处理循环引用）**
- [ ] **Step 2: 实现 `safeInfo/safeWarn/safeError` 输出 JSON**

---

### Task 2: 替换 register 的 console.error

**Files:**
- Modify: `web/app/api/auth/register/route.ts`

- [ ] **Step 1: 用 `safeError("register failed", { err: e })` 替换 `console.error(...)`**

---

### Task 3: 验证

- [ ] **Step 1: `npm run lint`**
- [ ] **Step 2:（可选）跑一遍 smoke，确保行为不变**

