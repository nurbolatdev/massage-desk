import type { Appointment } from "@/types";

/** A gap between two appointments becomes a free row from this length. */
export const FREE_GAP_MIN_MINUTES = 30;

export type TodayRow =
  | { kind: "appointment"; appointment: Appointment }
  | { kind: "free"; start: Date; end: Date };

export interface TodaySchedule {
  kind: "schedule" | "empty" | "finished";
  next: Appointment | null;
  rows: TodayRow[];
  laterCount: number;
}

const MS_PER_MINUTE = 60_000;

/** Whole minutes from `from` to `to`, rounded up, never below 0. */
export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / MS_PER_MINUTE));
}

function upcoming(appointments: readonly Appointment[], now: Date): Appointment[] {
  return appointments
    .filter((a) => a.status === "confirmed" && a.end.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Earliest confirmed appointment that has not ended; in progress counts. */
export function selectNextClient(
  appointments: readonly Appointment[],
  now: Date,
): Appointment | null {
  return upcoming(appointments, now)[0] ?? null;
}

export function todaySchedule(appointments: readonly Appointment[], now: Date): TodaySchedule {
  const candidates = upcoming(appointments, now);
  const next = candidates[0] ?? null;
  if (next === null) {
    const hadActive = appointments.some((a) => a.status === "confirmed" || a.status === "done");
    return { kind: hadActive ? "finished" : "empty", next: null, rows: [], laterCount: 0 };
  }
  const later = candidates.slice(1);
  const rows: TodayRow[] = [];
  let previous = next;
  for (const appointment of later) {
    const gap = minutesBetween(previous.end, appointment.start);
    if (gap >= FREE_GAP_MIN_MINUTES) {
      rows.push({ kind: "free", start: previous.end, end: appointment.start });
    }
    rows.push({ kind: "appointment", appointment });
    previous = appointment;
  }
  return { kind: "schedule", next, rows, laterCount: later.length };
}
