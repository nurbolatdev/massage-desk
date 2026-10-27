import type { AppointmentSource, AppointmentStatus } from "@massage-desk/shared";

/** Appointment as the master's app shows it (joined with client and service). */
export interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  start: Date;
  end: Date;
  status: AppointmentStatus;
  source: AppointmentSource;
}
