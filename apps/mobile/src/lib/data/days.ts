/** The calendar day (YYYY-MM-DD) of `now` in the given time zone. */
export function localDay(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** `day` (YYYY-MM-DD) moved by `n` days, may be negative; UTC date arithmetic, so DST cannot shift it. */
export function addDays(day: string, n: number): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + n)).toISOString().slice(0, 10);
}

/** The day after `day` (YYYY-MM-DD). */
export function nextDay(day: string): string {
  return addDays(day, 1);
}

/** ISO weekday of `day`: 1 (Monday) to 7 (Sunday). */
export function isoWeekday(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay() || 7;
}

/** The seven days, Monday to Sunday, of the week that contains `day`. */
export function weekDays(day: string): string[] {
  const monday = addDays(day, 1 - isoWeekday(day));
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** Noon UTC of `day`; format it with `timeZone: "UTC"`. */
export function dayDate(day: string): Date {
  return new Date(`${day}T12:00:00Z`);
}

/** True for a real calendar day written as YYYY-MM-DD. */
export function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year = 0, month = 1, date = 1] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.toISOString().slice(0, 10) === value;
}
