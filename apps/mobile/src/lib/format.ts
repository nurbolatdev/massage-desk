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
