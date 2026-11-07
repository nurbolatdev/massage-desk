import type { AppointmentSource, AppointmentStatus } from "@massage-desk/shared";

import type { Appointment } from "@/types";

import { ApiError } from "../api/errors";
import { NBSP, formatDayMonth, formatDayTitle, formatTime, plural } from "../format";
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

export type ChipStatus = Exclude<AppointmentStatus, "confirmed">;

/** The status that gets a header chip; a confirmed appointment is the normal case and has none (DESIGN.md section 7). */
export function statusChip(status: AppointmentStatus | undefined): ChipStatus | undefined {
  return status === undefined || status === "confirmed" ? undefined : status;
}

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
export const LOADING_LABEL = "Загрузка";

export const NO_SHOW_LABEL = "Не пришёл";
export const CANCEL_LABEL = "Отменить";
export const CANCEL_CONFIRM_TITLE = "Отменить запись?";
export const CANCEL_CONFIRM_YES = "Да, отменить";
export const NO_SHOW_CONFIRM_TITLE = "Клиент не пришёл?";
export const NO_SHOW_CONFIRM_TEXT =
  "Запись отметится как «не пришёл». Это видно в истории клиента и в отчётах.";
export const NO_SHOW_CONFIRM_YES = "Да, не пришёл";
export const ACTION_FAILED = "Не получилось сохранить. Проверьте интернет и попробуйте ещё раз.";
export const ACTION_CONFLICT = "Запись уже изменилась. Закройте окно — на экране новое состояние.";

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

/** "Запись на 2 ноября в 10:00 отменится, ..." */
export function cancelConfirmText(start: Date, timeZone: string): string {
  return `Запись на ${formatDayMonth(start, timeZone)} в ${formatTime(start, timeZone)} отменится, время станет свободным для бота. Клиенту сообщение не придёт — если нужно, напишите ему сами.`;
}

/** Which destructive actions the card offers; follows the API rules. */
export function cardActions(a: Appointment, now: Date): { cancel: boolean; noShow: boolean } {
  const confirmed = a.status === "confirmed";
  return { cancel: confirmed, noShow: confirmed && a.start.getTime() <= now.getTime() };
}

export function actionErrorText(error: unknown): string {
  return error instanceof ApiError && error.status === 409 ? ACTION_CONFLICT : ACTION_FAILED;
}

export interface CardLoadInput {
  appointmentsLoaded: boolean;
  settingsLoaded: boolean;
  settingsError: Error | null;
  appointmentsError: Error | null;
}

/** The card needs the day's list and the settings (time zone): it shows data only when both are present. */
export function cardLoad({ appointmentsLoaded, settingsLoaded, settingsError, appointmentsError }: CardLoadInput) {
  return {
    hasData: appointmentsLoaded && settingsLoaded,
    /** A failed settings or list load; both count as «refresh failed» when data is shown. */
    error: settingsError ?? appointmentsError,
  };
}
