import { ApiError } from "@/lib/api/errors";
import type { AppointmentConflict } from "@/lib/api/errors";
import { formatDayMonth, formatTime, plural } from "@/lib/format";

import { addDays, dayDate, localDay } from "./days";

export const TIME_OFF_SETTINGS_TITLE = "Выходные и отпуск";
export const TIME_OFF_TITLE = "Выходной или отпуск";
export const TIME_OFF_HINT = "Нажмите на первый и последний день отпуска. Один день — выходной.";
export const SAVE_LABEL = "Сохранить";
export const TIME_OFF_OFFLINE_TEXT = "Отметить выходной можно, когда телефон подключится к интернету.";
export const PAST_DAY_TEXT = "Этот день уже прошёл. Выберите сегодня или день позже.";
export const TOO_FAR_TEXT = "Так далеко отметить нельзя. Выберите день в ближайшие два года.";
export const TOO_LONG_TEXT = "Отпуск — не больше 365 дней. Выберите последний день раньше.";
export const INVALID_TIME_OFF_TEXT = "Эти дни отметить нельзя. Выберите другие.";
export const CONFLICT_CONFIRM_TITLE = "Закрыть дни с записями?";
export const CONFLICT_CONFIRM_TEXT =
  "Записи останутся — их нужно перенести или отменить самим. Новых записей на эти дни не будет.";
export const CONFLICT_CONFIRM_YES = "Да, закрыть дни";

export const MAX_AHEAD_DAYS = 729;
// 365 (not the server's 366) so a DST change can never push the stored length over its limit.
export const MAX_TIME_OFF_DAYS = 365;

export type TimeOffPickError = "past" | "tooFar" | "tooLong";
export type TimeOffPick = { from: string | null; to: string | null; error: TimeOffPickError | null };

export const EMPTY_PICK: TimeOffPick = { from: null, to: null, error: null };

/** Applies a tap on `day`; days are YYYY-MM-DD in the master's zone. */
export function pickDay(pick: TimeOffPick, day: string, today: string): TimeOffPick {
  if (day < today) return { ...pick, error: "past" };
  if (day > addDays(today, MAX_AHEAD_DAYS)) return { ...pick, error: "tooFar" };
  if (pick.from === day && pick.to === day) return EMPTY_PICK;
  if (pick.from !== null && pick.from === pick.to && day > pick.from) {
    if (dayCount(pick.from, day) > MAX_TIME_OFF_DAYS) return { ...pick, error: "tooLong" };
    return { from: pick.from, to: day, error: null };
  }
  return { from: day, to: day, error: null };
}

/** The picked days, or undefined while nothing is picked. */
export function pickRange(pick: TimeOffPick): { from: string; to: string } | undefined {
  return pick.from !== null && pick.to !== null ? { from: pick.from, to: pick.to } : undefined;
}

export function isPicked(pick: TimeOffPick): boolean {
  return pickRange(pick) !== undefined;
}

export function pickErrorText(error: TimeOffPickError): string {
  if (error === "past") return PAST_DAY_TEXT;
  if (error === "tooFar") return TOO_FAR_TEXT;
  return TOO_LONG_TEXT;
}

function dayCount(from: string, to: string): number {
  return Math.round((dayDate(to).getTime() - dayDate(from).getTime()) / 86_400_000) + 1;
}

/** "15 декабря", "15 – 22 декабря", "30 декабря – 5 января". */
export function timeOffTitle(from: string, to: string): string {
  const first = formatDayMonth(dayDate(from), "UTC");
  if (from === to) return first;
  const last = formatDayMonth(dayDate(to), "UTC");
  if (from.slice(0, 7) === to.slice(0, 7)) return `${Number(from.slice(8))} – ${last}`;
  return `${first} – ${last}`;
}

/** "Выходной" for one day, "Отпуск · 8 дней" for more. */
export function timeOffKind(from: string, to: string): string {
  const n = dayCount(from, to);
  return n === 1 ? "Выходной" : `Отпуск · ${n} ${plural(n, "день", "дня", "дней")}`;
}

export function timeOffErrorKind(error: unknown): "conflict" | "invalid" | "failed" {
  if (error instanceof ApiError) {
    if (error.code === "APPOINTMENT_CONFLICT" && (error.conflicts?.length ?? 0) > 0) return "conflict";
    if (error.code === "INVALID_TIME_OFF" || error.code === "INVALID_REQUEST") return "invalid";
  }
  return "failed";
}

/** The alert reads «На » + `day` (bold) + `rest`. */
export function conflictMessage(
  conflicts: AppointmentConflict[],
  timeZone: string,
): { day: string; rest: string } {
  const sorted = [...conflicts].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const first = sorted[0];
  if (first === undefined) return { day: "", rest: "" };
  const start = new Date(first.start);
  const name = first.clientName ?? "клиент без имени";
  const who = `${name}, ${formatTime(start, timeZone)}`;
  const day = formatDayMonth(start, timeZone);
  const n = sorted.length;
  if (n === 1) {
    return { day, rest: ` уже есть 1 запись (${who}). Перенесите её или отмените.` };
  }
  const days = new Set(sorted.map((c) => localDay(new Date(c.start), timeZone)));
  const where = days.size === 1 ? "" : " и в другие дни";
  const count = `${n} ${plural(n, "запись", "записи", "записей")}`;
  return { day, rest: `${where} уже есть ${count} (первая — ${who}). Перенесите их или отмените.` };
}
