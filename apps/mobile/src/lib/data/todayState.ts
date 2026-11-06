import { ApiError } from "@/lib/api/errors";
import { NBSP, formatSpan, plural } from "@/lib/format";

import { minutesBetween } from "./todaySchedule";

export const OFFLINE_TITLE = "Нет интернета";
export const OFFLINE_EMPTY_TEXT = "Расписание появится, когда телефон подключится к интернету.";
export const LOAD_ERROR_TEXT = "Не получилось загрузить расписание. Попробуйте ещё раз.";
export const FORBIDDEN_TEXT = "Этот аккаунт не подключён к расписанию. Напишите Нурболату.";

export const NEXT_CLIENT_TITLE = "Следующий клиент";
export const MANUAL_CHIP = "Вручную";
export const BOT_ON_TEXT = "Бот отвечает";
export const FINISHED_TITLE = "На сегодня больше записей нет";
export const EMPTY_TITLE = "Сегодня записей нет";
export const EMPTY_TEXT = "Бот запишет клиентов на свободное время и пришлёт вам уведомление.";
export const BOT_OFF_TEXT = "Бот выключен";
export const BOT_OFF_TITLE = "Бот не отвечает клиентам";
export const BOT_OFF_TEXT_LONG = "Все новые сообщения приходят вам в «Чаты»";
export const CALL_LABEL = "Позвонить";
export const WRITE_LABEL = "Написать";
export const ENABLE_BOT_LABEL = "Включить";
export const ENABLE_BOT_FAILED = "Не получилось включить бота. Проверьте интернет и попробуйте ещё раз.";

export function tomorrowText(count: number, time: string): string {
  return `Завтра: ${count} ${plural(count, "запись", "записи", "записей")}, первая в ${time}`;
}

/** Label above the next client: «… · через 25 мин», or «… · сейчас» when in progress. */
export function nextClientLabel(start: Date, now: Date): string {
  if (start.getTime() <= now.getTime()) return `${NEXT_CLIENT_TITLE} · сейчас`;
  return `${NEXT_CLIENT_TITLE} · через ${formatSpan(minutesBetween(now, start))}`;
}

export function untilText(time: string): string {
  return `до ${time}`;
}

export function serviceLine(name: string, minutes: number): string {
  return `${name} · ${minutes}${NBSP}мин`;
}

export function moreClientsTitle(n: number): string {
  return `Ещё ${n} ${plural(n, "клиент", "клиента", "клиентов")} сегодня`;
}

export function freeTimeText(endTime: string, minutes: number): string {
  return `Свободно до ${endTime} · ${formatSpan(minutes)}`;
}

export function offlineSavedText(savedAt: string): string {
  return `Показано расписание, сохранённое в ${savedAt}. Изменения недоступны.`;
}

export type TodayView = "loading" | "offlineEmpty" | "error" | "list";

export interface TodayStateInput {
  online: boolean;
  hasData: boolean;
  error: Error | null;
}

export interface TodayState {
  view: TodayView;
  showOfflineBanner: boolean;
  /** Text of the error banner; set only when `view` is "error". */
  errorText: string | null;
  /** The «Обновить» button is shown with the error (not for forbidden). */
  canRetry: boolean;
}

export function todayState({ online, hasData, error }: TodayStateInput): TodayState {
  if (hasData) {
    return { view: "list", showOfflineBanner: !online, errorText: null, canRetry: false };
  }
  if (!online) {
    return { view: "offlineEmpty", showOfflineBanner: false, errorText: null, canRetry: false };
  }
  if (error !== null) {
    const forbidden = error instanceof ApiError && error.kind === "forbidden";
    return {
      view: "error",
      showOfflineBanner: false,
      errorText: forbidden ? FORBIDDEN_TEXT : LOAD_ERROR_TEXT,
      canRetry: !forbidden,
    };
  }
  return { view: "loading", showOfflineBanner: false, errorText: null, canRetry: false };
}
