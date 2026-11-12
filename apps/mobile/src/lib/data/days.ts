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

/** Number of days in the month of `day`. */
function daysInMonth(day: string): number {
  const [year = 0, month = 1] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `day` moved by `n` months, may be negative; same day number, clamped to the last day of that month. */
export function addMonths(day: string, n: number): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1 + n, 1)).toISOString().slice(0, 10);
  return `${first.slice(0, 8)}${String(Math.min(date, daysInMonth(first))).padStart(2, "0")}`;
}

/** Every day, 1st to last, of the month that contains `day`. */
export function monthDays(day: string): string[] {
  const prefix = day.slice(0, 8);
  return Array.from({ length: daysInMonth(day) }, (_, i) => `${prefix}${String(i + 1).padStart(2, "0")}`);
}

/** Month cells, Monday first: `null` pads before the 1st and after the last day up to full weeks. */
export function monthGrid(day: string): (string | null)[] {
  const days = monthDays(day);
  const lead = isoWeekday(days[0] ?? day) - 1;
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
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

const offsetFormats = new Map<string, Intl.DateTimeFormat>();

function offsetFormat(timeZone: string): Intl.DateTimeFormat {
  let format = offsetFormats.get(timeZone);
  if (format === undefined) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormats.set(timeZone, format);
  }
  return format;
}

/** Offset of `timeZone` from UTC at the instant `at`, in milliseconds. */
function zoneOffsetMs(at: Date, timeZone: string): number {
  const parts = offsetFormat(timeZone).formatToParts(at);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? "0");
  const wall = Date.UTC(
    part("year"),
    part("month") - 1,
    part("day"),
    part("hour") % 24,
    part("minute"),
    part("second"),
  );
  return wall - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant of the local time `HH:mm` on `day` (YYYY-MM-DD) in `timeZone`. */
export function zonedTime(day: string, time: string, timeZone: string): Date {
  const wall = new Date(`${day}T${time}:00Z`).getTime();
  const guess = wall - zoneOffsetMs(new Date(wall), timeZone);
  return new Date(wall - zoneOffsetMs(new Date(guess), timeZone));
}
