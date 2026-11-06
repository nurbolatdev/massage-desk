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

/** The day after `day` (YYYY-MM-DD); UTC date arithmetic, so DST cannot shift it. */
export function nextDay(day: string): string {
  const [year = 0, month = 1, date = 1] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + 1));
  return next.toISOString().slice(0, 10);
}
