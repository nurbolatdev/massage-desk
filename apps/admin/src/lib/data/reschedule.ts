import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

export type RescheduledAppointment = components["schemas"]["AppointmentResponse"];

export function rescheduleAppointment(
  api: ReturnType<typeof createApi>,
  id: string,
  start: Date,
): Promise<RescheduledAppointment> {
  return unwrap(
    api.POST("/appointments/{id}/reschedule", {
      params: { path: { id } },
      body: { start: start.toISOString() },
    }),
  );
}

export type RescheduleErrorKind = "taken" | "outside" | "gone" | "offline" | "failed";

/** Maps a failed reschedule to what the master should be told. */
export function rescheduleErrorKind(error: unknown): RescheduleErrorKind {
  if (!(error instanceof ApiError)) return "failed";
  if (error.kind === "network") return "offline";
  if (error.code === "NOT_CONFIRMED" || error.status === 404) return "gone";
  if (error.code === "OUTSIDE_SCHEDULE") return "outside";
  if (error.status === 409) return "taken";
  return "failed";
}
