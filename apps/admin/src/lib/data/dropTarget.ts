import { localDay, zonedTime } from "@massage-desk/shared";

import { minutesOfDay, SLOT_MINUTES, type Span } from "./calendar";
import type { Appointment } from "./schedule";

export type GridStep = { x: number; y: number };

export type DropTargetInput = {
  appointment: Appointment;
  days: readonly string[];
  range: Span;
  timeZone: string;
  dx: number;
  dy: number;
  step: GridStep;
};

/** Only confirmed appointments can be dragged to another time. */
export function canReschedule(appointment: Appointment): boolean {
  return appointment.status === "confirmed";
}

function hhmm(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mins = String(minutes % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

/** Computes the new start instant for a dragged appointment, or `null` when unchanged or invalid. */
export function dropTarget({ appointment, days, range, timeZone, dx, dy, step }: DropTargetInput): Date | null {
  if (step.y <= 0 || days.length === 0) return null;

  const day = localDay(appointment.start, timeZone);
  const dayIndex = days.indexOf(day);
  if (dayIndex === -1) return null;

  const rows = Math.round(dy / step.y);
  const cols = step.x > 0 ? Math.round(dx / step.x) : 0;
  if (rows === 0 && cols === 0) return null;

  const targetDayIndex = Math.min(Math.max(dayIndex + cols, 0), days.length - 1);
  const targetDay = days[targetDayIndex];
  if (!targetDay || (rows === 0 && targetDayIndex === dayIndex)) return null;

  const duration = Math.round((appointment.end.getTime() - appointment.start.getTime()) / 60_000);
  const minStart = range.start * 60;
  const maxStart = Math.min(range.end * 60, 1440) - duration;
  if (duration <= 0 || maxStart < minStart) return null;

  const startMin = minutesOfDay(appointment.start, day, timeZone);
  const snapped = Math.round((startMin + rows * SLOT_MINUTES) / SLOT_MINUTES) * SLOT_MINUTES;
  const clamped = Math.min(Math.max(snapped, minStart), maxStart);

  const target = zonedTime(targetDay, hhmm(clamped), timeZone);
  return target.getTime() === appointment.start.getTime() ? null : target;
}
