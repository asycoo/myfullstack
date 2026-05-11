# 密码策略（基础档）设计稿

**日期**：2026-04-20  
**范围**：第 5 步安全基线中的密码策略（注册时校验）  
**目标档位**：基础（学习期推荐）

---

## 目标与非目标

### 目标
- 注册密码最小长度 **>= 8**。
- 拒绝常见弱密码（黑名单），例如：`12345678`、`password`、`qwerty`、`11111111` 等（大小写不敏感、忽略首尾空格）。
- 仍沿用现有“统一 API 返回结构 + Zod 校验失败 400”的风格。

### 非目标（本次不做）
- 强制复杂度（大小写/数字/特殊字符必须同时存在）。
- 泄露密码校验细节过多（避免给攻击者太多信号）。
- 修改登录逻辑（登录仍按现有 bcrypt compare）。

---

## 设计选择

### 校验位置：Zod Schema 层（推荐）
在 `web/lib/auth/auth.schemas.ts` 的 `RegisterSchema` 上通过 `superRefine` 做弱密码校验：
- 好处：校验集中、错误结构统一、route handler 不需要额外 if/else。

### 黑名单实现
新增模块：
- `web/lib/auth/password.policy.ts`

导出：
- `isWeakPassword(pw: string): boolean`
- `normalizePassword(pw: string): string`（内部使用：trim + toLowerCase）

黑名单策略（基础档）：
- 一个小集合（Set）覆盖最常见弱密码。
- 仅做“完全匹配”（normalized 后相等），不做复杂模式（如重复字符、键盘序列）以控制范围。

---

## 错误提示与状态码

### 错误码
仍走 Zod 校验失败：
- HTTP 400
- `error.code = "BAD_REQUEST"`
- message：`"参数校验失败"`
- details：Zod flatten 输出

### 前端提示
前端会从 `error.message` 或 details 中提取，保持当前展示方式即可。

---

## 影响面

修改：
- `web/lib/auth/auth.schemas.ts`

新增：
- `web/lib/auth/password.policy.ts`

建议扩展 smoke（可选，但推荐）：
- 增加一次弱密码注册尝试，期望 400 + BAD_REQUEST（不必断言 details 的具体结构，避免 brittle）。

