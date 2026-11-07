import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import type { Appointment } from "@/types";

export type AppointmentListItem = components["schemas"]["AppointmentListItem"];

export function fetchAppointments(
  api: ReturnType<typeof createApi>,
  from: string,
  to: string,
): Promise<AppointmentListItem[]> {
  return unwrap(api.GET("/appointments", { params: { query: { from, to } } }));
}

export function toAppointment(item: AppointmentListItem): Appointment {
  return {
    id: item.id,
    clientId: item.clientId,
    clientName: item.clientName ?? item.clientPhone,
    clientPhone: item.clientPhone,
    serviceName: item.serviceName,
    start: new Date(item.start),
    end: new Date(item.end),
    status: item.status,
    source: item.source,
  };
}

/** Maps raw API items to the view type, ordered by start. */
export function toAppointments(items: AppointmentListItem[]): Appointment[] {
  return items.map(toAppointment).sort((a, b) => a.start.getTime() - b.start.getTime());
}
