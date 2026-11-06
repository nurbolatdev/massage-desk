const formats = new Map<string, Intl.DateTimeFormat>();

function cached(key: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  let f = formats.get(key);
  if (f === undefined) {
    f = new Intl.DateTimeFormat("ru-RU", options);
    formats.set(key, f);
  }
  return f;
}

/** "10:00"; in the given time zone, or the device zone when none is given. */
export function formatTime(date: Date, timeZone?: string): string {
  return cached(`time|${timeZone ?? ""}`, { hour: "2-digit", minute: "2-digit", timeZone }).format(date);
}

/** "9:00" (no leading zero); used only where the mockups show it so. */
export function formatTimeShort(date: Date, timeZone?: string): string {
  return cached(`timeshort|${timeZone ?? ""}`, { hour: "numeric", minute: "2-digit", timeZone }).format(date);
}

/** "Вторник, 27 октября" */
export function formatDayTitle(date: Date, timeZone?: string): string {
  const s = cached(`day|${timeZone ?? ""}`, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone,
  }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const NBSP = " ";

/** Russian plural form for `n`: 1 клиент, 2 клиента, 5 клиентов. */
export function plural(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n);
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return many;
  if (mod10 === 1) return one;
  if (mod10 >= 2 && mod10 <= 4) return few;
  return many;
}

/** "25 мин", "1 час", "1,5 часа", "1 ч 15 мин"; a non-breaking space joins number and unit. */
export function formatSpan(minutes: number): string {
  if (minutes < 60) return `${minutes}${NBSP}мин`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours}${NBSP}${plural(hours, "час", "часа", "часов")}`;
  if (rest === 30) return `${hours},5${NBSP}часа`;
  return `${hours}${NBSP}ч ${rest}${NBSP}мин`;
}

/** "Понедельник" */
export function formatWeekday(date: Date, timeZone?: string): string {
  const s = cached(`weekday|${timeZone ?? ""}`, { weekday: "long", timeZone }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "2 ноября" */
export function formatDayMonth(date: Date, timeZone?: string): string {
  return cached(`daymonth|${timeZone ?? ""}`, {
    day: "numeric",
    month: "long",
    timeZone,
  }).format(date);
}
