import { fail } from "@/lib/api";

function getAllowedOrigins() {
  const env = process.env.ALLOWED_ORIGINS;
  if (env && env.trim()) {
    return env
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return ["http://localhost:3000"];
}

export function requireAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;

  const allowed = getAllowedOrigins();
  if (!allowed.includes(origin)) {
    throw fail("FORBIDDEN", "Origin 不被允许");
  }
}

