import http from "node:http";
import { randomBytes } from "node:crypto";
import { URL } from "node:url";

const PORT = Number(process.env.CORS_LAB_PORT ?? 4000);

/**
 * CORS switches (intentionally explicit for learning):
 * - CORS_ENABLED: "1" | "0"
 * - CORS_ALLOW_ORIGIN: exact origin (e.g. "http://localhost:3000") or "*"
 * - CORS_ALLOW_CREDENTIALS: "1" | "0"
 * - CORS_ALLOW_METHODS: "GET,POST,PATCH,DELETE,OPTIONS"
 * - CORS_ALLOW_HEADERS: "content-type"
 * - CORS_HANDLE_OPTIONS: "1" | "0"
 *
 * Cookie switches:
 * - COOKIE_SAMESITE: "lax" | "strict" | "none"
 * - COOKIE_SECURE: "1" | "0"
 */
function envBool(name, defaultValue = false) {
  const v = process.env[name];
  if (v == null) return defaultValue;
  return v === "1" || v.toLowerCase() === "true";
}

function envString(name, defaultValue) {
  return process.env[name] ?? defaultValue;
}

function getConfig() {
  return {
    port: PORT,
    cors: {
      enabled: envBool("CORS_ENABLED", true),
      allowOrigin: envString("CORS_ALLOW_ORIGIN", "http://localhost:3000"),
      allowCredentials: envBool("CORS_ALLOW_CREDENTIALS", true),
      allowMethods: envString("CORS_ALLOW_METHODS", "GET,POST,PATCH,DELETE,OPTIONS"),
      allowHeaders: envString("CORS_ALLOW_HEADERS", "content-type"),
      handleOptions: envBool("CORS_HANDLE_OPTIONS", true),
    },
    cookie: {
      sameSite: envString("COOKIE_SAMESITE", "lax"),
      secure: envBool("COOKIE_SECURE", false),
    },
  };
}

function parseCookies(cookieHeader) {
  const out = {};
  if (!cookieHeader) return out;
  const parts = cookieHeader.split(";");
  for (const p of parts) {
    const [k, ...rest] = p.trim().split("=");
    if (!k) continue;
    out[k] = rest.join("=");
  }
  return out;
}

function setCorsHeaders(req, res, cfg) {
  if (!cfg.cors.enabled) return;
  const origin = req.headers.origin;
  if (!origin) return;

  // For learning: we only allow a single configured origin (or "*")
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Origin", cfg.cors.allowOrigin);
  if (cfg.cors.allowCredentials) {
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }
  res.setHeader("Access-Control-Allow-Methods", cfg.cors.allowMethods);
  res.setHeader("Access-Control-Allow-Headers", cfg.cors.allowHeaders);
  res.setHeader("Access-Control-Max-Age", "600");
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body, null, 2));
}

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return null;
  return JSON.parse(raw);
}

const server = http.createServer(async (req, res) => {
  const cfg = getConfig();
  setCorsHeaders(req, res, cfg);

  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  // Preflight
  if (req.method === "OPTIONS") {
    if (!cfg.cors.handleOptions) {
      return json(res, 404, { ok: false, error: "OPTIONS not handled (preflight will fail)" });
    }
    res.statusCode = 204;
    return res.end();
  }

  if (path === "/config") {
    return json(res, 200, {
      config: cfg,
      hint: "Change env vars and restart server to experiment.",
    });
  }

  if (path === "/login" && req.method === "POST") {
    const session = randomBytes(12).toString("hex");
    const sameSite = String(cfg.cookie.sameSite).toLowerCase();
    const secure = cfg.cookie.secure;

    // Note: SameSite=None requires Secure in modern browsers (we keep this for experimentation).
    const cookieParts = [
      `corslab=${session}`,
      "Path=/",
      "HttpOnly",
      `SameSite=${sameSite[0]?.toUpperCase() + sameSite.slice(1)}`,
    ];
    if (secure) cookieParts.push("Secure");

    res.setHeader("Set-Cookie", cookieParts.join("; "));
    res.setHeader("X-Debug-Set-Cookie", cookieParts.join("; "));
    return json(res, 200, { ok: true, session, note: "Cookie set on localhost:4000" });
  }

  if (path === "/me" && req.method === "GET") {
    const cookies = parseCookies(req.headers.cookie);
    const session = cookies.corslab ?? null;
    if (!session) {
      return json(res, 401, { ok: false, error: "No corslab cookie found" });
    }
    return json(res, 200, { ok: true, session });
  }

  if (path === "/posts/1" && req.method === "PATCH") {
    const cookies = parseCookies(req.headers.cookie);
    const session = cookies.corslab ?? null;
    if (!session) {
      return json(res, 401, { ok: false, error: "No corslab cookie found" });
    }
    const body = await readJson(req);
    return json(res, 200, { ok: true, updated: body ?? null });
  }

  if (path === "/posts/1" && req.method === "DELETE") {
    const cookies = parseCookies(req.headers.cookie);
    const session = cookies.corslab ?? null;
    if (!session) {
      return json(res, 401, { ok: false, error: "No corslab cookie found" });
    }
    return json(res, 200, { ok: true, deleted: true });
  }

  return json(res, 404, { ok: false, error: "Not found", method: req.method, path });
});

server.listen(PORT, () => {
  console.log(`CORS lab server listening on http://localhost:${PORT}`);
  console.log(`Config endpoint: http://localhost:${PORT}/config`);
});

