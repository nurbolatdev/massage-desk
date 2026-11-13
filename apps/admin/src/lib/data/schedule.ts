import type { components } from "@massage-desk/api-types";
import { weekDays } from "@massage-desk/shared";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";

type Api = ReturnType<typeof createApi>;

export type AppointmentListItem = components["schemas"]["AppointmentListItem"];
export type TimeOffItem = components["schemas"]["TimeOffResponse"];
export type WorkingBlock = components["schemas"]["WorkingBlock"];
export type WorkingHours = components["schemas"]["WorkingHoursResponse"];

/** Appointment as the schedule shows it (joined with client and service). */
export interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  serviceId: string;
  serviceName: string;
  start: Date;
  end: Date;
  status: AppointmentListItem["status"];
  source: AppointmentListItem["source"];
}

/** A time off period; `end` is exclusive. */
export type TimeOffPeriod = { id: string; start: Date; end: Date };

export function fetchAppointments(api: Api, from: string, to: string): Promise<AppointmentListItem[]> {
  return unwrap(api.GET("/appointments", { params: { query: { from, to } } }));
}

export function fetchTimeOff(api: Api, from: string, to: string): Promise<TimeOffItem[]> {
  return unwrap(api.GET("/time-off", { params: { query: { from, to } } }));
}

export function fetchWorkingHours(api: Api): Promise<WorkingHours> {
  return unwrap(api.GET("/working-hours"));
}

/** Maps raw API items to the view type, ordered by start. */
export function toAppointments(items: AppointmentListItem[]): Appointment[] {
  return items
    .map((item) => ({
      id: item.id,
      clientId: item.clientId,
      clientName: item.clientName ?? item.clientPhone,
      clientPhone: item.clientPhone,
      serviceId: item.serviceId,
      serviceName: item.serviceName,
      start: new Date(item.start),
      end: new Date(item.end),
      status: item.status,
      source: item.source,
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Maps raw API items to periods, ordered by start. */
export function toTimeOffPeriods(items: TimeOffItem[]): TimeOffPeriod[] {
  return items
    .map((item) => ({ id: item.id, start: new Date(item.start), end: new Date(item.end) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Monday to Sunday of the week that contains `day`. */
export function weekRange(day: string): { from: string; to: string } {
  const days = weekDays(day);
  return { from: days[0] ?? day, to: days[6] ?? day };
}
