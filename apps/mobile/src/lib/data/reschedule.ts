import type { Appointment } from "@/types";

import { ApiError } from "../api/errors";
import { formatDayMonth, formatTime } from "../format";
import { ACTION_CONFLICT, ACTION_FAILED } from "./appointmentCard";
import { bookingErrorKind } from "./bookingForm";
import { type DayChoice, serviceMeta, shortDayParts } from "./newBooking";

export const RESCHEDULE_TITLE = "Перенос записи";
export const NOW_LABEL = "Сейчас";
export const NEW_DAY = "Новый день";
export const NEW_TIME = "Новое время";
export const RESCHEDULE_LABEL = "Перенести";
export const RESCHEDULE_CONFIRM_TITLE = "Перенести запись?";
export const RESCHEDULE_CONFIRM_YES = "Да, перенести";
export const RESCHEDULE_OFFLINE_TEXT = "Перенести запись можно, когда телефон подключится к интернету.";
export const RESCHEDULE_GONE_TITLE = "Запись уже изменилась";
export const RESCHEDULE_GONE_TEXT = "Её больше нельзя перенести. Вернитесь к карточке записи.";

/** "Пн, 2 ноября · 10:00" */
export function currentLine(start: Date, timeZone: string): string {
  const { weekday } = shortDayParts(start, timeZone);
  const capital = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  return `${capital}, ${formatDayMonth(start, timeZone)} · ${formatTime(start, timeZone)}`;
}

/** "Айгуль Сапарова · Массаж спины, 60 мин" */
export function clientServiceLine(a: Appointment): string {
  const minutes = Math.round((a.end.getTime() - a.start.getTime()) / 60000);
  return `${a.clientName} · ${a.serviceName}, ${serviceMeta(minutes)}`;
}

/** "вт, 3 нояб., 11:30" */
export function shortWhen(start: Date, timeZone: string): string {
  const { weekday, day, month } = shortDayParts(start, timeZone);
  return `${weekday}, ${day} ${month}, ${formatTime(start, timeZone)}`;
}

export function rescheduleLabel(start: Date, timeZone: string): string {
  return `${RESCHEDULE_LABEL} на ${shortWhen(start, timeZone)}`;
}

export function rescheduleConfirmText(from: Date, to: Date, timeZone: string): string {
  return `Запись переедет с ${shortWhen(from, timeZone)} на ${shortWhen(to, timeZone)}. Клиенту сообщение не придёт — если нужно, напишите ему сами.`;
}

export type RescheduleErrorKind = "taken" | "outside" | "conflict" | "failed";

export function rescheduleErrorKind(error: unknown): RescheduleErrorKind {
  if (error instanceof ApiError && (error.code === "NOT_CONFIRMED" || error.status === 404)) return "conflict";
  const kind = bookingErrorKind(error);
  return kind === "taken" || kind === "outside" ? kind : "failed";
}

export function rescheduleSheetErrorText(error: unknown): string {
  return rescheduleErrorKind(error) === "conflict" ? ACTION_CONFLICT : ACTION_FAILED;
}

/** The appointment's own day when it can be picked, else today. */
export function rescheduleDay(appointmentDay: string, choices: DayChoice[], today: string): string {
  return choices.some((c) => c.day === appointmentDay) ? appointmentDay : today;
}
