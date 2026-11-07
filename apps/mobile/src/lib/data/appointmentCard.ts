import type { AppointmentSource, AppointmentStatus } from "@massage-desk/shared";

import type { Appointment } from "@/types";

import { NBSP, formatDayTitle, formatTime, plural } from "../format";
import { localDay, nextDay } from "./days";

export const CARD_TITLE = "Запись";
export const BACK_LABEL = "Назад";
export const WHATSAPP_LABEL = "WhatsApp";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  confirmed: "Подтверждена",
  cancelled: "Отменена",
  no_show: "Не пришёл",
  done: "Прошла",
};

export const SERVICE_LABEL = "Услуга";
export const DURATION_LABEL = "Длительность";
export const BOOKED_BY_LABEL = "Кто записал";
export const TIME_LABEL = "Время";
export const TIME_FREED = "Освобождено для бота";

export const SOURCE_TEXT: Record<AppointmentSource, string> = {
  bot: "Бот",
  manual: "Вы, вручную",
};

export const NOT_FOUND_TITLE = "Запись не найдена";
export const NOT_FOUND_TEXT = "Возможно, её перенесли на другой день.";
export const OPEN_APPOINTMENT_HINT = "Открыть запись";

export interface DetailRow {
  label: string;
  value: string;
  bot: boolean;
}

/** "10:00 – 11:00" */
export function timeRange(start: Date, end: Date, timeZone?: string): string {
  return `${formatTime(start, timeZone)} – ${formatTime(end, timeZone)}`;
}

/** "Понедельник, 2 ноября"; for yesterday "Вчера, воскресенье, 1 ноября". */
export function cardDayTitle(start: Date, now: Date, timeZone: string): string {
  const title = formatDayTitle(start, timeZone);
  if (nextDay(localDay(start, timeZone)) === localDay(now, timeZone)) {
    return `Вчера, ${title.charAt(0).toLowerCase()}${title.slice(1)}`;
  }
  return title;
}

/** "1 минута", "2 минуты", "5 минут"; a non-breaking space joins number and unit. */
export function durationText(minutes: number): string {
  return `${minutes}${NBSP}${plural(minutes, "минута", "минуты", "минут")}`;
}

/** First letters of the first two words, upper case; "" when the name has no letters. */
export function initials(name: string): string {
  if (!/\p{L}/u.test(name)) return "";
  return name
    .split(/\s+/)
    .filter((word) => word !== "")
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}

/** Rows of the details block; which rows appear depends on the status. */
export function detailRows(a: Appointment): DetailRow[] {
  const service: DetailRow = { label: SERVICE_LABEL, value: a.serviceName, bot: false };
  const bookedBy: DetailRow = { label: BOOKED_BY_LABEL, value: SOURCE_TEXT[a.source], bot: a.source === "bot" };
  switch (a.status) {
    case "cancelled":
      return [service, { label: TIME_LABEL, value: TIME_FREED, bot: false }];
    case "no_show":
      return [service, bookedBy];
    case "confirmed":
    case "done": {
      const minutes = Math.round((a.end.getTime() - a.start.getTime()) / 60000);
      return [service, { label: DURATION_LABEL, value: durationText(minutes), bot: false }, bookedBy];
    }
  }
}

/** Route params that open the card of `a`. */
export function appointmentRouteParams(a: Appointment, timeZone: string): { id: string; day: string } {
  return { id: a.id, day: localDay(a.start, timeZone) };
}
