import { dayDate } from "@massage-desk/shared";

const formats = new Map<string, Intl.DateTimeFormat>();

function cached(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = formats.get(key);
  if (f === undefined) {
    f = new Intl.DateTimeFormat("ru-RU", options);
    formats.set(key, f);
  }
  return f;
}

export const NBSP = "\u00a0";

/** "9:00" (no leading zero) in the master's time zone. */
export function formatTime(date: Date, timeZone: string): string {
  return cached(`time|${timeZone}`, {
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(date);
}

/** "8 ноября" for a calendar day (YYYY-MM-DD). */
export function formatDayMonth(day: string): string {
  return cached("daymonth", { day: "numeric", month: "long", timeZone: "UTC" }).format(dayDate(day));
}

/** "2 нояб." in the master's time zone. */
export function formatDayMonthShort(date: Date, timeZone: string): string {
  return cached(`daymonthshort|${timeZone}`, { day: "numeric", month: "short", timeZone }).format(date);
}

/** Russian plural form for `n`: 1 запись, 2 записи, 5 записей. */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}
