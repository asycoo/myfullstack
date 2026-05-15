# 现有项目扩展计划：功能 1～6 + Redis 验证码登录

**目标仓库**：`my-fullstack-app`（Next.js App Router + Prisma + PostgreSQL，沿用现有鉴权与分层习惯）。  
**原则**：在**不推翻**现有登录/Session 体系的前提下增量演进；**第 6 类能力**单独挂在 **`/labs/*`**，与博客主线在导航与产品上区隔。

---

## 0. 总览

| 块 | 内容 | 路由/位置约定 |
|----|------|----------------|
| **基础** | 本地/部署接入 Redis；Node 侧 Redis 客户端封装 | `web/lib/redis/`、`docker-compose` 或部署平台 Redis 插件 |
| **登录增强** | 图形/算术验证码 → **校验前写入 Redis**、一次性消费、TTL | 登录页 + `POST /api/auth/login` 前增加 `GET/POST` 验证码接口 |
| **1** | 内容与互动：评论、标签（多对多）、点赞/收藏、通知（可先只做「评论回复」） | `/posts/[slug]` 下挂评论；`/posts/manage` 扩展标签 |
| **2** | 文件与媒体：用户头像、通用附件（复用 Blob 策略） | `/api/users/avatar` 或 `/api/uploads/...`；`User` 表字段 |
| **3** | 账号扩展：邮箱验证、忘记密码、个人资料、会话列表 | `/settings`、`/api/me/sessions` 等 |
| **4** | 运营与后台：审计日志、文章软删除、简单角色（作者/管理员） | 管理端 + `AuditLog` 表；`Post.deletedAt` |
| **5** | 工程能力：CSV 导出、Webhook 接收、Feature flag | `/api/export/posts`、`/api/webhooks/...`；`FeatureFlag` 表或 env |
| **6** | 实验产品：短链、Webhook 调试收件箱等 | **仅** `app/labs/**` 与 **`/labs/...`** 导航入口 |

---

## 1. 基础设施（建议第 1 阶段，约 1 周）

### 1.1 Redis

- **本地**：`docker-compose.yml`（与现有 Postgres 同文件或并列 service）增加 `redis:7`，端口如 `6379`。
- **环境变量**：`REDIS_URL`（推荐单 URL）或 `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD`。
- **代码**：`web/lib/redis/client.ts`（单例、`PING`、错误日志）；**不要在 Edge Runtime 使用**（Route 默认 Node 即可）。
- **健康检查**：扩展 `GET /api/health` 或单独 `GET /api/health/redis` 返回 Redis 连通性（勿在生产暴露敏感信息）。

### 1.2 文档与回归

- `DOC/` 本篇后续可追加「环境变量清单」「本地起服务顺序」。
- `npm run test:smoke` 按需增加：健康检查、登录带验证码成功路径（见下）。

---

## 2. 登录 + 验证码（Redis）（建议第 2 阶段，约 1 周）

### 2.1 行为约定

- **登录前**：用户必须先拿到 **captchaId + 题目/图片**（`GET /api/auth/captcha` 或等价）。
- **提交登录**：`POST /api/auth/login` body 增加 `captchaId`、`captchaAnswer`（或图形坐标方案，首版可算术题降低前端成本）。
- **Redis Key 设计**（示例）：
  - `captcha:{id}` → 存正确答案哈希或规范化答案 + **TTL 120～300 秒**；
  - 校验成功 **`DEL`** 该 key，防重放；失败可 **`INCR` 失败次数** + 短 TTL 防刷。
- **限流**：同一 IP / 同一 `captchaId` 验证次数用 Redis 计数（与现有限流可并存，Redis 用于跨实例）。

### 2.2 安全注意

- 验证码答案**不可明文长期存**；**不要**把 captchaId 放进 JWT 长期凭证。
- 生产需 **HTTPS**；登录错误返回**模糊文案**（防枚举账号是否存在可与现有一致）。

### 2.3 前端

- `login` 页：展示验证码、刷新按钮；失败清空或换新 captcha。

---

## 3. 功能 1：内容与互动（约 2～3 周，可拆迭代）

**建议顺序**：标签（多对多）→ 评论 → 点赞（可选）→ 通知（可选）。

| 迭代 | 交付物 |
|------|--------|
| 3.1 | `Tag`、`PostTag`（或 `_PostToTag`）模型；管理端给文章打标签；公开详情/列表展示标签 |
| 3.2 | `Comment`：`postId`、`authorId`、`parentId`（nullable）、`content`、时间；公开 API 分页 GET + 登录 POST；**XSS**：首版纯文本 + 转义或白名单 |
| 3.3 | （可选）`PostLike` 幂等唯一 `(userId, postId)` |
| 3.4 | （可选）`Notification` + 未读数；或仅「有人回复我」邮件占位 |

**API 风格**：与现有 `/api/posts` 一致，CSRF 写接口、分页 query。

---

## 4. 功能 2：文件与媒体（约 1 周）

- **用户头像**：`User.avatarUrl`；上传复用 Vercel Blob 或现有策略；`PATCH /api/me` 或专用路由。
- **通用附件**（可选）：独立 `Attachment` 表 + 与 `Post` 关联，后台删除级联策略写清楚。

---

## 5. 功能 3：账号扩展（约 2 周）

| 子项 | 要点 |
|------|------|
| 邮箱验证 | 注册后发 token（Redis TTL + 或 DB `EmailVerificationToken`）；`GET /api/auth/verify-email?token=` |
| 忘记密码 | Redis 存 `reset:{token}` → `userId` + TTL；邮件用 Resend 等 |
| 个人资料 | `name`、头像、简介；`PATCH /api/me` |
| 会话列表 | 读 `Session` 表，支持撤销单条/全部（除当前） |

---

## 6. 功能 4：运营与后台（约 1～2 周）

- **审计日志**：`AuditLog`（`actorId`、`action`、`targetType`、`targetId`、`metadata` JSON、`createdAt`）；关键 PATCH/DELETE 写一行。
- **软删除**：`Post.deletedAt`；公开列表/搜索过滤 `deletedAt IS NULL`；管理端「回收站」恢复。
- **角色**：`User.role` enum `USER` / `ADMIN`；管理接口 `requireAdmin()`；首版可种子账号管理员。

---

## 7. 功能 5：工程与可靠性（约 1～2 周）

- **CSV 导出**：`GET /api/export/posts`（仅作者或管理员），流式或大分页；超时与行数上限。
- **Webhook 接收**：`POST /api/webhooks/inbound`（签名头 `X-Signature` + HMAC 校验）；payload 落库或 Redis 列表（TTL）。
- **Feature flag**：表 `FeatureFlag(key, enabled)` 或环境变量 + 简单 `lib/feature-flags.ts` 缓存读 Redis（可选）。

---

## 8. 功能 6：实验区 `/labs`（约 1～2 周，与主线弱耦合）

**路由约定**（Next App Router）：

- `web/app/labs/layout.tsx`：统一说明「实验功能，接口与数据模型可能变更」。
- 示例子路由：
  - `web/app/labs/shortlinks/page.tsx` + `/api/labs/shortlinks/...`
  - `web/app/labs/webhook-inbox/page.tsx` + `/api/labs/webhook-inbox/...`

**数据**：可用独立表前缀 `LabsShortLink` 或 `labs_*`，避免与 `Post` 混淆。

**导航**：在首页或页脚增加「实验室」入口，**不**放入核心「文章」主路径。

---

## 9. 「线程池 / 异步任务」与 Redis（与 5、登录邮件协同）

- **推荐形态**：**BullMQ（或 Bull）+ Redis** + **独立 worker 脚本** `node web/scripts/queue-worker.mjs`（或 `workers/`），**不要**在 Next Route 里常驻消费队列。
- **任务示例**：发送验证邮件、生成 CSV、清理过期 captcha（若未全用 TTL）。
- **CPU 密集子任务**（可选进阶）：在 worker 内使用 **`worker_threads`** 处理压缩/大文件，与「线程池」概念对齐。

---

## 10. 建议总体排期（按周，可压缩为双周 Sprint）

| 周次 | 主题 |
|------|------|
| W1 | Redis 接入 + 健康检查 + 文档环境说明 |
| W2 | 验证码登录（Redis）+ smoke + 登录页改造 |
| W3–W4 | 标签多对多 + 管理端与公开展示 |
| W5–W6 | 评论（API + 详情页 + 分页 + CSRF） |
| W7 | 头像与资料 PATCH |
| W8–W9 | 邮箱验证 / 忘记密码（Redis token + 邮件） |
| W10 | 审计日志 + 软删除 + 角色雏形 |
| W11 | 导出 CSV + Webhook 其一 +（可选）队列 worker |
| W12 | `/labs` 短链或 Webhook inbox 其一 + 复盘 DOC |

**说明**：周数为**粗粒度**；若每周时间有限，可将「点赞/通知/双 Webhook」标为 **P2 以后**。

---

## 11. 依赖关系简图（实现先后）

```text
Redis 基础
  └→ 验证码登录
  └→（可选）队列 / 限流 / 缓存

标签（多对多）
  └→ 文章详情/列表展示

评论
  └→ 依赖 Post、User；（可选）通知

软删除 / 审计 / 角色
  └→ 影响所有读列表/搜索 SQL（记得加 deletedAt 条件）

/labs
  └→ 仅依赖 Redis + PG，可与博客并行开发
```

---

## 12. 验收与回归清单（每阶段结束）

- `npm run lint`
- `BASE_URL=... npm run test:smoke`（逐步增加：验证码流程、评论 CRUD 一条、labs 健康）
- 新迁移在 CI/本地 `prisma migrate deploy` 通过
- 敏感接口：**速率限制** + **CSRF**（与现有一致）

---

## 13. 风险与取舍

| 风险 | 应对 |
|------|------|
| Redis 未部署导致登录全挂 | 开发环境 Compose 必起；生产显式依赖 + 健康检查告警 |
| 评论 XSS / 垃圾 | 首版纯文本 + 长度限制 +（后续）频控 |
| 功能过多导致分支臃肿 | **严格** `/labs` 与「实验 API」前缀；大功能开 feature 分支 |

---

## 14. 下一步（执行层面）

1. 在仓库根或 `web/` 增加 **Redis 的 docker-compose** 与 **`.env.example` 变量说明**。  
2. 按 **W1 → W2** 实现验证码登录闭环，再并行 **标签 / labs** 之一。  
3. 每完成一周，在 `DOC/` 追加一篇短复盘（可复用课表文末周记模板）。

如需我**直接在仓库里生成 compose 骨架与空计划 checklist 文件以外的代码**，请在 Agent 模式下说明从 **W1 还是 W2** 开始落地。

---

## 15. 实施进度（2026-05-09 起）

| 项 | 状态 |
|----|------|
| W1 Redis（compose、`web/lib/redis`、health `redis` 字段） | 已落地 |
| W2 验证码（`captcha.service`、`GET /api/auth/captcha`、`POST /api/auth/login` 校验、登录页联调） | 已落地 |
| `/labs` 占位与首页入口 | 已落地 |
| 功能块 1～5（评论、标签、头像、设置、审计等） | 部分：`3.1` 文章标签（多对多）已落地；评论等未开始 |
