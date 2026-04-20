function firstFromXForwardedFor(header: string): string | null {
  // "client, proxy1, proxy2"
  const first = header.split(",")[0]?.trim();
  return first ? first : null;
}

export function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return firstFromXForwardedFor(xff) ?? "unknown";

  const xri = request.headers.get("x-real-ip");
  if (xri) return xri.trim() || "unknown";

  return "unknown";
}

