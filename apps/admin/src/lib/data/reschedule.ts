import { isoWeekday, localDay } from "@massage-desk/shared";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { formatDayMonthShort, formatTime } from "@/lib/format";

import { WEEKDAYS_SHORT, spanText } from "./calendar";
import type { Appointment, AppointmentResponse } from "./schedule";

export function rescheduleAppointment(
  api: ReturnType<typeof createApi>,
  id: string,
  start: Date,
): Promise<AppointmentResponse> {
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

export const RESCHEDULE_TITLE = "Перенести запись?";
export const RESCHEDULE_CONFIRM = "Перенести";
export const RESCHEDULE_BACK = "Вернуть как было";
export const RESCHEDULE_PICK_AGAIN = "Выбрать другое время";
export const RESCHEDULE_CLOSE = "Закрыть";
export const DRAG_HINT = "Перетащите запись на другое время. Занятое время и перерывы не принимают запись.";
export const KEYBOARD_HINT = "С клавиатуры: пробел — взять запись, стрелки — сдвинуть, Enter — поставить, Esc — отменить.";
export const DRAG_INSTRUCTIONS =
  "Чтобы перенести запись, нажмите пробел. Стрелки вверх и вниз сдвигают запись на 15 минут, влево и вправо — на день. Enter — поставить, Esc — отменить.";
export const DRAG_CANCELLED = "Перенос отменён. Запись на месте.";

function shortDay(date: Date, timeZone: string): string {
  const weekday = (WEEKDAYS_SHORT[isoWeekday(localDay(date, timeZone)) - 1] ?? "").toLowerCase();
  return `${weekday} ${formatDayMonthShort(date, timeZone)}`;
}

/** Two-line slot badge: `"пн 2 нояб."` and `"16:00–17:00"`. */
export function slotLines(start: Date, end: Date, timeZone: string): { day: string; time: string } {
  return { day: shortDay(start, timeZone), time: spanText({ start, end }, timeZone) };
}

/** `"чт 5 нояб., 16:00"` */
export function whenShort(start: Date, timeZone: string): string {
  return `${shortDay(start, timeZone)}, ${formatTime(start, timeZone)}`;
}

/** Confirmation body naming the client and clarifying that no message is sent. */
export function rescheduleText(clientName: string): string {
  return `Вы перетащили запись: ${clientName}. Клиенту сообщение не придёт — если нужно, напишите ему сами.`;
}

/** Confirmation body when the new time was picked from the appointment panel. */
export function pickedText(clientName: string): string {
  return `Вы выбрали новое время для записи: ${clientName}. Клиенту сообщение не придёт — если нужно, напишите ему сами.`;
}

const STATIC_ERRORS: Record<Exclude<RescheduleErrorKind, "taken">, string> = {
  outside: "Это время уже нельзя записать. Выберите другое время.",
  gone: "Запись уже изменилась. Закройте окно — на экране новое состояние.",
  offline: "Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.",
  failed: "Не получилось перенести. Попробуйте ещё раз через минуту.",
};

/** Russian error message for a failed reschedule attempt shown in the confirm dialog. */
export function rescheduleErrorText(kind: RescheduleErrorKind, start: Date, timeZone: string): string {
  if (kind === "taken") return `${formatTime(start, timeZone)} уже занято. Выберите другое время.`;
  return STATIC_ERRORS[kind];
}

/** Screen-reader announcement when picking up an appointment with the keyboard or pointer. */
export function dragStartText(appointment: Appointment, timeZone: string): string {
  return `Запись: ${appointment.clientName}, ${whenShort(appointment.start, timeZone)}. Двигайте стрелками.`;
}

/** Screen-reader announcement when moving an appointment to a valid target time. */
export function dragMoveText(start: Date, timeZone: string): string {
  return `Новое время: ${whenShort(start, timeZone)}.`;
}

/** Screen-reader announcement on drop or cancel. */
export function dropText(start: Date | null, timeZone: string): string {
  return start ? `Новое время: ${whenShort(start, timeZone)}. Подтвердите перенос.` : DRAG_CANCELLED;
}
