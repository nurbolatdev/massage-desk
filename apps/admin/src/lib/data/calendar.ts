import { isoWeekday, localDay, nextDay, zonedTime, type WorkingWindow } from "@massage-desk/shared";

import { ApiError } from "@/lib/api/errors";
import { NBSP, formatDayMonth, formatDayMonthShort, formatTime, plural } from "@/lib/format";

import type { Appointment, TimeOffPeriod } from "./schedule";

export const SLOT_MINUTES = 15;
export const MAX_ROWS = 96;
export const DEFAULT_HOURS = { start: 9, end: 19 };
export const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

export const STATUS_TEXT: Record<Appointment["status"], string> = {
  confirmed: "Подтверждена",
  cancelled: "Отменена",
  no_show: "Не пришёл",
  done: "Прошла",
};

export const SOURCE_TEXT: Record<Appointment["source"], string> = {
  bot: "Бот",
  manual: "Вручную",
};

type Span = { start: number; end: number };

/** Minutes from the local midnight of `day`; 0 before the day, 1440 after it. */
export function minutesOfDay(date: Date, day: string, timeZone: string): number {
  const localDate = localDay(date, timeZone);
  if (localDate < day) return 0;
  if (localDate > day) return 1440;
  const parts = clockFormat(timeZone).formatToParts(date);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return part("hour") * 60 + part("minute");
}

const clockFormats = new Map<string, Intl.DateTimeFormat>();
function clockFormat(timeZone: string): Intl.DateTimeFormat {
  let format = clockFormats.get(timeZone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-GB", { timeZone, hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
    clockFormats.set(timeZone, format);
  }
  return format;
}

/** Whole hours that contain every span (in minutes of the day); the default hours when there are none. */
export function hourRange(spans: Span[]): Span {
  if (spans.length === 0) return DEFAULT_HOURS;
  const start = Math.floor(Math.min(...spans.map((s) => s.start)) / 60);
  const end = Math.ceil(Math.max(...spans.map((s) => s.end)) / 60);
  return { start, end: Math.max(end, start + 1) };
}

/** Grid rows of a span of minutes: 1-based first row and the row count, clipped to `range` (hours); null when it lies outside. */
export function rowsOf(startMin: number, endMin: number, range: Span): { start: number; span: number } | null {
  const total = (range.end - range.start) * (60 / SLOT_MINUTES);
  const from = range.start * 60;
  if (endMin <= from || startMin >= range.end * 60) return null;
  const first = Math.min(Math.max(Math.floor((startMin - from) / SLOT_MINUTES) + 1, 1), total);
  const last = Math.min(Math.max(Math.ceil((endMin - from) / SLOT_MINUTES) + 1, first + 1), total + 1);
  return { start: first, span: last - first };
}

/** The only place that builds grid class names; the CSS safelist covers 1..MAX_ROWS. */
export function rowClass({ start, span }: { start: number; span: number }): string {
  for (const n of [start, span]) {
    if (!Number.isInteger(n) || n < 1 || n > MAX_ROWS) throw new RangeError(`Grid row out of range: ${n}`);
  }
  return `row-start-${start} row-span-${span}`;
}

/** Gaps between neighbouring working windows. */
export function breaksOf(windows: WorkingWindow[]): WorkingWindow[] {
  const gaps: WorkingWindow[] = [];
  for (let i = 1; i < windows.length; i++) {
    const before = windows[i - 1];
    const after = windows[i];
    if (before && after && after.start.getTime() > before.end.getTime()) {
      gaps.push({ start: before.end, end: after.start });
    }
  }
  return gaps;
}

/** A day off: known hours with no window, or time off that covers every window (the whole day if hours are unknown). */
export function isDayOff(
  day: string,
  windows: WorkingWindow[] | undefined,
  timeOff: TimeOffPeriod[],
  timeZone: string,
): boolean {
  const covers = (from: Date, to: Date) => timeOff.some((p) => p.start <= from && p.end >= to);
  if (windows === undefined) return covers(zonedTime(day, "00:00", timeZone), zonedTime(nextDay(day), "00:00", timeZone));
  if (windows.length === 0) return true;
  return windows.every((w) => covers(w.start, w.end));
}

/** Appointments to draw: a cancelled one that overlaps an active one is hidden; ordered by start. */
export function gridAppointments(list: Appointment[]): Appointment[] {
  const active = list.filter((a) => a.status !== "cancelled");
  return list
    .filter((a) => a.status !== "cancelled" || !active.some((b) => b.start < a.end && a.start < b.end))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Day header note; `count` excludes cancelled appointments. */
export function dayNote(count: number, off: boolean): string {
  if (off) return "выходной";
  if (count === 0) return "свободно";
  return `${count} ${plural(count, "запись", "записи", "записей")}`;
}

/** "2 – 8 ноября", or "30 ноября – 6 декабря" across months. */
export function weekLabel(days: readonly string[]): string {
  const first = days[0] ?? "";
  const last = days[days.length - 1] ?? first;
  if (first.slice(0, 7) === last.slice(0, 7)) return `${Number(first.slice(8))} – ${formatDayMonth(last)}`;
  return `${formatDayMonth(first)} – ${formatDayMonth(last)}`;
}

/** "Пн 2 нояб., 10:00–11:00" */
export function whenText(a: Appointment, timeZone: string): string {
  const weekday = WEEKDAYS_SHORT[isoWeekday(localDay(a.start, timeZone)) - 1] ?? "";
  return `${weekday} ${formatDayMonthShort(a.start, timeZone)}, ${formatTime(a.start, timeZone)}–${formatTime(a.end, timeZone)}`;
}

/** "Спина · 60 мин" */
export function serviceText(a: Appointment): string {
  const minutes = Math.round((a.end.getTime() - a.start.getTime()) / 60000);
  return `${a.serviceName} · ${minutes}${NBSP}мин`;
}

/** Which body the page shows: cached data wins over an error. */
export function scheduleView({ hasData, error }: { hasData: boolean; error: unknown }): "ready" | "error" | "loading" {
  if (hasData) return "ready";
  return error == null ? "loading" : "error";
}

export function loadErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === "network") return "Нет связи с сервером. Проверьте интернет и нажмите «Повторить».";
    if (error.status !== undefined) return `Сервер ответил с ошибкой. Код: ${error.status}.`;
  }
  return "Попробуйте ещё раз через минуту.";
}
