import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";

import type { AppointmentListItem } from "./appointments";

export type AppointmentAction = "cancel" | "noShow";
export type AppointmentResponse = components["schemas"]["AppointmentResponse"];

export function postAppointmentAction(
  api: ReturnType<typeof createApi>,
  id: string,
  action: AppointmentAction,
): Promise<AppointmentResponse> {
  const params = { params: { path: { id } } };
  return unwrap(
    action === "cancel"
      ? api.POST("/appointments/{id}/cancel", params)
      : api.POST("/appointments/{id}/no-show", params),
  );
}

/** Returns a new list where only the item with this id has the new status. */
export function withStatus(
  items: AppointmentListItem[] | undefined,
  id: string,
  status: AppointmentListItem["status"],
): AppointmentListItem[] | undefined {
  return items?.map((item) => (item.id === id ? { ...item, status } : item));
}
