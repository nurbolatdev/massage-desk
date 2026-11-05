const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });

/** "10:00"; in the given time zone, or the device zone when none is given. */
export function formatTime(date: Date, timeZone?: string): string {
  if (timeZone === undefined) return timeFormat.format(date);
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone }).format(date);
}

/** "Вторник, 27 октября" */
export function formatDayTitle(date: Date, timeZone?: string): string {
  const s =
    timeZone === undefined
      ? dayFormat.format(date)
      : new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long", timeZone }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
