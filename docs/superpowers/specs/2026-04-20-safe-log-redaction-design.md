# 日志脱敏（safeLog）设计稿

**日期**：2026-04-20  
**范围**：第 5 步安全基线中的日志脱敏（最小改动方案）  

---

## 目标与非目标

### 目标
- 在服务端记录必要的错误上下文，但**不泄露敏感信息**（密码、cookie、session、csrf、authorization 等）。
- 用一个轻量的 `safeLog` 工具替代零散的 `console.*`。
- 开发环境可带更多调试信息；生产环境只输出最小必要字段。

### 非目标
- 引入第三方日志库（pino/winston）（后续可升级）。
- 全量埋点所有成功请求（本次先覆盖错误路径）。

---

## 脱敏规则（redaction）

### 需要脱敏的字段（按 key 名匹配，大小写不敏感）
- `password`
- `authorization`
- `cookie`
- `set-cookie`
- `session`
- `sessionid` / `sessionId`
- `csrftoken` / `csrfToken`

### email 处理
- `email`：保留首字符与域名，其余打码，例如 `y***@163.com`

### token / id 处理
- 对疑似 token/id 的字符串：保留前 4 后 4，中间用 `***`

### 递归脱敏
- 对 object/array 递归处理（限制深度与总大小，避免巨大对象/循环引用导致崩溃）。

---

## 输出策略

### API
新增 `web/lib/log/safe-log.ts`：
- `safeInfo(message, meta?)`
- `safeWarn(message, meta?)`
- `safeError(message, meta?)`

### 输出内容
- `time`：ISO 时间
- `level`：info/warn/error
- `msg`：message
- `meta`：已脱敏的 meta（dev 环境更详细，prod 环境更克制）

---

## 接入点（第一批）
- 替换 `web/app/api/auth/register/route.ts` 里的 `console.error("register failed:", e)`
- 对其它 route handler 的 catch（如 login）保持最小改动：仅在确实需要时增加安全日志（避免噪音）

