const timeFormat = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });

export function formatTime(date: Date): string {
  return timeFormat.format(date);
}

/** "Вторник, 27 октября" */
export function formatDayTitle(date: Date): string {
  const s = dayFormat.format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}
