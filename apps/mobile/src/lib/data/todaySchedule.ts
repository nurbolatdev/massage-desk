import type { Appointment } from "@/types";

import type { WorkingWindow } from "./workingHours";

/** A gap between two appointments becomes a free row from this length. */
export const FREE_GAP_MIN_MINUTES = 30;

export type TodayRow =
  | { kind: "appointment"; appointment: Appointment }
  | { kind: "free"; start: Date; end: Date };

/** The master's own pause between two working blocks of the day. */
export type BreakRow = { kind: "break"; start: Date; end: Date };

export interface TodaySchedule {
  kind: "schedule" | "empty" | "finished";
  next: Appointment | null;
  rows: (TodayRow | BreakRow)[];
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

/**
 * Free and break rows of the gap [from, to]: free time only inside working windows,
 * a break only between two neighbouring windows. Unknown or empty windows give nothing.
 */
function gapRows(
  from: Date,
  to: Date,
  windows: readonly WorkingWindow[] | undefined,
): (TodayRow | BreakRow)[] {
  const rows: (TodayRow | BreakRow)[] = [];
  if (windows === undefined) return rows;
  windows.forEach((w, i) => {
    const freeStart = new Date(Math.max(from.getTime(), w.start.getTime()));
    const freeEnd = new Date(Math.min(to.getTime(), w.end.getTime()));
    if (minutesBetween(freeStart, freeEnd) >= FREE_GAP_MIN_MINUTES) {
      rows.push({ kind: "free", start: freeStart, end: freeEnd });
    }
    const following = windows[i + 1];
    if (following === undefined) return;
    const breakStart = new Date(Math.max(from.getTime(), w.end.getTime()));
    const breakEnd = new Date(Math.min(to.getTime(), following.start.getTime()));
    if (breakEnd.getTime() > breakStart.getTime()) {
      rows.push({ kind: "break", start: breakStart, end: breakEnd });
    }
  });
  return rows;
}

export function todaySchedule(
  appointments: readonly Appointment[],
  now: Date,
  windows: readonly WorkingWindow[] | undefined,
): TodaySchedule {
  const candidates = upcoming(appointments, now);
  const next = candidates[0] ?? null;
  if (next === null) {
    const hadActive = appointments.some((a) => a.status === "confirmed" || a.status === "done");
    return { kind: hadActive ? "finished" : "empty", next: null, rows: [], laterCount: 0 };
  }
  const later = candidates.slice(1);
  const rows: (TodayRow | BreakRow)[] = [];
  let previous = next;
  for (const appointment of later) {
    rows.push(...gapRows(previous.end, appointment.start, windows));
    rows.push({ kind: "appointment", appointment });
    previous = appointment;
  }
  return { kind: "schedule", next, rows, laterCount: later.length };
}

/** Confirmed appointments of a day: how many, and when the first one starts. */
export function tomorrowSummary(
  appointments: readonly Appointment[],
): { count: number; first: Date } | null {
  const confirmed = appointments.filter((a) => a.status === "confirmed");
  const first = confirmed.map((a) => a.start).sort((a, b) => a.getTime() - b.getTime())[0];
  if (first === undefined) return null;
  return { count: confirmed.length, first };
}
