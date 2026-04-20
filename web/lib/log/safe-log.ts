type Jsonish =
  | null
  | boolean
  | number
  | string
  | Jsonish[]
  | { [k: string]: Jsonish };

const SENSITIVE_KEYS = new Set([
  "password",
  "authorization",
  "cookie",
  "set-cookie",
  "session",
  "sessionid",
  "sessionId",
  "csrftoken",
  "csrfToken",
]);

function maskMiddle(s: string, keepStart = 4, keepEnd = 4) {
  if (s.length <= keepStart + keepEnd) return "***";
  return `${s.slice(0, keepStart)}***${s.slice(-keepEnd)}`;
}

function maskEmail(email: string) {
  const e = email.trim();
  const at = e.indexOf("@");
  if (at <= 0) return "***";
  const name = e.slice(0, at);
  const domain = e.slice(at + 1);
  const first = name.slice(0, 1);
  return `${first}***@${domain}`;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && (v as { constructor?: unknown }).constructor === Object;
}

export function redact(input: unknown, opts?: { maxDepth?: number }) {
  const maxDepth = opts?.maxDepth ?? 6;
  const seen = new WeakSet<object>();

  const walk = (v: unknown, depth: number): Jsonish => {
    if (depth > maxDepth) return "[TRUNCATED]" as unknown as Jsonish;
    if (v === null) return null;
    if (typeof v === "string") return v;
    if (typeof v === "number") return v;
    if (typeof v === "boolean") return v;
    if (typeof v === "bigint") return v.toString();
    if (v instanceof Date) return v.toISOString();
    if (v instanceof Error) {
      return {
        name: v.name,
        message: v.message,
        stack: process.env.NODE_ENV === "production" ? undefined : v.stack,
      } as unknown as Jsonish;
    }
    if (Array.isArray(v)) {
      return v.map((item) => walk(item, depth + 1));
    }
    if (typeof v === "object") {
      if (seen.has(v as object)) return "[CIRCULAR]" as unknown as Jsonish;
      seen.add(v as object);

      // Prefer own enumerable props
      const out: Record<string, Jsonish> = {};
      const obj = v as Record<string, unknown>;
      for (const [k, val] of Object.entries(obj)) {
        const keyLower = k.toLowerCase();
        if (SENSITIVE_KEYS.has(keyLower)) {
          out[k] = "***";
          continue;
        }
        if (keyLower === "email" && typeof val === "string") {
          out[k] = maskEmail(val);
          continue;
        }
        if (typeof val === "string" && (keyLower.includes("token") || keyLower.includes("secret") || keyLower.includes("id"))) {
          out[k] = maskMiddle(val);
          continue;
        }
        out[k] = walk(val, depth + 1);
      }

      // For non-plain objects, keep a hint in dev
      if (!isPlainObject(v) && process.env.NODE_ENV !== "production") {
        out.__type = (v as { constructor?: { name?: unknown } }).constructor?.name as unknown as Jsonish;
      }
      return out;
    }
    return String(v);
  };

  return walk(input, 0);
}

function emit(level: "info" | "warn" | "error", msg: string, meta?: unknown) {
  const payload = {
    time: new Date().toISOString(),
    level,
    msg,
    meta: meta === undefined ? undefined : redact(meta),
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function safeInfo(msg: string, meta?: unknown) {
  emit("info", msg, meta);
}

export function safeWarn(msg: string, meta?: unknown) {
  emit("warn", msg, meta);
}

export function safeError(msg: string, meta?: unknown) {
  emit("error", msg, meta);
}

