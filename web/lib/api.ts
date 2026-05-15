import { z } from "zod";

export type ApiErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TOO_MANY_REQUESTS"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

export type ApiError = {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
};

export type ApiResponse<T> =
  | { data: T; error: null }
  | { data: null; error: ApiError };

export function ok<T>(data: T, init?: ResponseInit) {
  return Response.json({ data, error: null } satisfies ApiResponse<T>, init);
}

export function fail(code: ApiErrorCode, message: string, init?: ResponseInit & { details?: unknown }) {
  const status =
    init?.status ??
    (code === "BAD_REQUEST"
      ? 400
      : code === "UNAUTHORIZED"
        ? 401
        : code === "FORBIDDEN"
          ? 403
          : code === "NOT_FOUND"
            ? 404
            : code === "CONFLICT"
              ? 409
              : code === "TOO_MANY_REQUESTS"
                ? 429
                : code === "SERVICE_UNAVAILABLE"
                  ? 503
                  : 500);

  const body: ApiResponse<never> = {
    data: null,
    error: {
      code,
      message,
      details: init?.details,
    },
  };

  return Response.json(body, { status, headers: init?.headers });
}

export function failZod(error: z.ZodError) {
  return fail("BAD_REQUEST", "参数校验失败", { details: error.flatten() });
}
