import type { ApiProblem, ErrorCode } from "@massage-desk/api-types";

export type AppointmentConflict = NonNullable<ApiProblem["conflicts"]>[number];

export type ApiErrorKind = "network" | "unauthorized" | "forbidden" | "problem" | "server";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly code?: ErrorCode;
  readonly conflicts?: AppointmentConflict[];

  constructor(
    kind: ApiErrorKind,
    options: { status?: number; code?: ErrorCode; conflicts?: AppointmentConflict[] } = {},
  ) {
    // The message never carries the server's `detail`.
    super(kind);
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status;
    this.code = options.code;
    this.conflicts = options.conflicts;
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

function isConflict(item: unknown): item is AppointmentConflict {
  if (typeof item !== "object" || item === null) return false;
  const c = item as Record<string, unknown>;
  return (
    typeof c.appointmentId === "string" &&
    typeof c.start === "string" &&
    typeof c.end === "string" &&
    (typeof c.clientName === "string" || c.clientName === null)
  );
}

/** Maps a failed response (status and parsed body) to an ApiError. */
export function toApiError(status: number, body: unknown): ApiError {
  if (status === 401) return new ApiError("unauthorized", { status });
  if (status === 403) return new ApiError("forbidden", { status });
  if (status >= 400 && status < 500) {
    if (isApiProblem(body)) {
      const conflicts = Array.isArray(body.conflicts) ? body.conflicts.filter(isConflict) : undefined;
      return new ApiError("problem", { status, code: body.code, conflicts });
    }
  }
  return new ApiError("server", { status });
}
