# CORS 实验室：A/B/C/D 常见坑总结

本实验基于：

- 前端（Next 页面）：`http://localhost:3000/cors-lab`
- 后端（cors-lab server）：`http://localhost:4000`

你会用环境变量启动 `cors:server` 来刻意制造不同的 CORS / Cookie 场景，再用页面按钮触发：

- `POST /login`（响应里有 `Set-Cookie`）
- `GET /me`（依赖 cookie）
- `PATCH /posts/1`（会触发 **OPTIONS 预检**）
- `DELETE /posts/1`（通常也会触发预检）

> 重要提示
>
> - CORS 只影响 **浏览器里的 fetch/XHR**；`curl` / Postman 不受影响。
> - 当 CORS 失败时，JS 侧常见表现是 `TypeError: Failed to fetch`，但 **Network 面板里可能能看到请求/响应**。

---

## 启动方式（通用）

在 `web/` 目录：

```bash
npm run cors:server
```

或带环境变量（下面每个场景都会给出一条命令）。

---

## 基线配置（应当全部正常）

```bash
CORS_ALLOW_ORIGIN="http://localhost:3000" \
CORS_ALLOW_CREDENTIALS=1 \
CORS_HANDLE_OPTIONS=1 \
COOKIE_SAMESITE=lax \
COOKIE_SECURE=0 \
npm run cors:server
```

预期现象：

- `POST /login`：200（能看到返回 JSON）
- `GET /me`：200（能读到 `corslab` cookie）
- `PATCH /posts/1`：200（预检通过）

---

## A：不处理 OPTIONS（预检必挂）

### 启动命令

```bash
CORS_HANDLE_OPTIONS=0 npm run cors:server
```

### 预期现象

- `POST /login` / `GET /me`：可能仍正常（取决于浏览器是否触发预检）
- **`PATCH /posts/1`：失败**（因为浏览器先发 OPTIONS 预检，后端返回 404/不正确响应）

### 典型控制台关键词

- `preflight`
- `Response to preflight request doesn't pass access control check`
- `CORS preflight channel did not succeed`

### 修复方式

```bash
CORS_HANDLE_OPTIONS=1 npm run cors:server
```

---

## B：`Access-Control-Allow-Origin: *` + `credentials: include`（Cookie 场景必挂）

### 启动命令（故意制造错误）

```bash
CORS_ALLOW_ORIGIN="*" \
CORS_ALLOW_CREDENTIALS=1 \
CORS_HANDLE_OPTIONS=1 \
npm run cors:server
```

### 预期现象

当页面开关 `credentials: include` 开启时：

- **`POST /login`：被浏览器拦截**
  - JS 侧常见是 `Failed to fetch`
  - `Set-Cookie` 不会被接受（cookie 种不进去）
- `GET /me`：401（因为没有 cookie）

### 典型控制台关键词

- `must not be '*' when the request's credentials mode is 'include'`

### 修复方式

必须使用 **具体 Origin**（且建议同时 `Allow-Credentials=true`）：

```bash
CORS_ALLOW_ORIGIN="http://localhost:3000" \
CORS_ALLOW_CREDENTIALS=1 \
npm run cors:server
```

---

## C：`Access-Control-Allow-Credentials` 不允许（cookie 永远带不上/写不进）

### 启动命令

```bash
CORS_ALLOW_ORIGIN="http://localhost:3000" \
CORS_ALLOW_CREDENTIALS=0 \
CORS_HANDLE_OPTIONS=1 \
npm run cors:server
```

### 预期现象

即使页面开了 `credentials: include`：

- `POST /login`：通常仍 200（JS 能读到响应）
- **但跨域 `Set-Cookie` 不会生效**
- `GET /me`：401（因为 cookie 没被写入/没被带回）

> 直觉：CORS 让你“读响应” ≠ 允许你“携带凭证（cookie）”。

### 修复方式

```bash
CORS_ALLOW_CREDENTIALS=1 npm run cors:server
```

---

## D：`SameSite=None` 但不 `Secure`（现代浏览器拒收 cookie）

### 启动命令（故意制造错误）

```bash
CORS_ALLOW_ORIGIN="http://localhost:3000" \
CORS_ALLOW_CREDENTIALS=1 \
CORS_HANDLE_OPTIONS=1 \
COOKIE_SAMESITE=none \
COOKIE_SECURE=0 \
npm run cors:server
```

### 预期现象

- `POST /login`：可能 200（你能读到返回 JSON）
- **但浏览器会拒收 `Set-Cookie`**
- `GET /me`：401（没有 cookie）

### 典型控制台 / DevTools 关键词

- `SameSite=None` + `Secure`
- `Set-Cookie was blocked`
- `This Set-Cookie was blocked because it had the 'SameSite=None' attribute but did not have the 'Secure' attribute`

### 修复方式（生产常见）

```bash
COOKIE_SAMESITE=none COOKIE_SECURE=1 npm run cors:server
```

注意：

- `Secure=1` 意味着 cookie 只在 **https** 下有效
- 所以要在本地真正跑通 `SameSite=None; Secure`，你需要让前端/后端在 https 下运行（例如使用 mkcert 或反向代理）

---

## 快速心智模型（背下来就够用）

- **跨域带 Cookie** 必须同时满足：
  - 前端：`credentials: "include"`
  - 后端：`Access-Control-Allow-Origin` = **具体 origin**（不能是 `*`）
  - 后端：`Access-Control-Allow-Credentials: true`
  - 后端：正确处理 **OPTIONS 预检**（尤其是 PATCH/DELETE）
  - Cookie：跨站需要 `SameSite=None; Secure`（生产 https）

