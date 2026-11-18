import { z } from "zod";

/** Shared domain model: one definition for the API, the master's app and the admin panel. */

export const APPOINTMENT_STATUSES = ["confirmed", "cancelled", "no_show", "done"] as const;
export const AppointmentStatus = z.enum(APPOINTMENT_STATUSES);
export type AppointmentStatus = z.infer<typeof AppointmentStatus>;

export const APPOINTMENT_SOURCES = ["bot", "manual"] as const;
export const AppointmentSource = z.enum(APPOINTMENT_SOURCES);
export type AppointmentSource = z.infer<typeof AppointmentSource>;

export const MESSAGE_AUTHORS = ["client", "bot", "master"] as const;
export const MessageAuthor = z.enum(MESSAGE_AUTHORS);
export type MessageAuthor = z.infer<typeof MessageAuthor>;

export const ROLES = ["master", "admin"] as const;
export const Role = z.enum(ROLES);
export type Role = z.infer<typeof Role>;

/** Statuses that occupy time in the schedule. */
export function isActiveStatus(status: AppointmentStatus): boolean {
  return status === "confirmed" || status === "done";
}

export const Service = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  durationMin: z.number().int().positive(),
  price: z.number().nonnegative(),
  active: z.boolean(),
});
export type Service = z.infer<typeof Service>;

/** Local calendar day in the master's time zone, "YYYY-MM-DD". */
export const LocalDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

export const SlotsQuery = z.object({
  serviceId: z.string().uuid(),
  day: LocalDay,
});
export type SlotsQuery = z.infer<typeof SlotsQuery>;
