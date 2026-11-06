import type { ApiProblem, ErrorCode } from "@massage-desk/api-types";

export type ApiErrorKind = "network" | "unauthorized" | "forbidden" | "problem" | "server";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: ErrorCode;

  constructor(kind: ApiErrorKind, options: { status?: number; code?: ErrorCode } = {}) {
    // The message never carries the server's `detail`.
    super(kind);
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status;
    this.code = options.code;
  }
}

// The server owns the set of codes; callers branch on the ones they know.
function isApiProblem(body: unknown): body is ApiProblem {
  return (
    typeof body === "object" &&
    body !== null &&
    "code" in body &&
    typeof body.code === "string"
  );
}

/** Maps a failed response (status and parsed body) to an ApiError. */
export function toApiError(status: number, body: unknown): ApiError {
  if (status === 401) return new ApiError("unauthorized", { status });
  if (status === 403) return new ApiError("forbidden", { status });
  if (status >= 400 && status < 500) {
    if (isApiProblem(body)) return new ApiError("problem", { status, code: body.code });
  }
  return new ApiError("server", { status });
}
