import { formatDayMonth, formatDayTitle, formatTime, plural } from "@/lib/format";
import type { Appointment } from "@/types";

import { addDays, dayDate, isoWeekday, localDay } from "./days";
import { BOOKING_DAYS } from "./newBooking";
import type { TimeOffPeriod } from "./timeOff";
import { FREE_GAP_MIN_MINUTES, minutesBetween, type TodayRow } from "./todaySchedule";

export const MONTHS = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

export const WEEKDAYS_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;

export const PREV_WEEK_LABEL = "Прошлая неделя";
export const NEXT_WEEK_LABEL = "Следующая неделя";
export const PREV_MONTH_LABEL = "Прошлый месяц";
export const NEXT_MONTH_LABEL = "Следующий месяц";
export const VIEW_SWITCH_LABEL = "Вид";
export const WEEK_VIEW_LABEL = "Неделя";
export const MONTH_VIEW_LABEL = "Месяц";
export const COUNT_LEGEND_SAMPLE = "5";
export const COUNT_LEGEND_TEXT = " — число записей";
export const OPEN_WEEK_HINT = "Открыть неделю";
export const EMPTY_DAY_TEXT = "На этот день записей нет";
export const DAY_OFF_SUMMARY = "Выходной";
export const DAY_OFF_TEXT = "Выходной день — бот не предлагает это время";
export const DAY_OFF_BUTTON = "Выходной — запись закрыта";
export const NO_APPOINTMENTS_SUMMARY = "Записей нет";
export const FREE_ALL_DAY_TEXT = "Свободно весь день";
export const DAY_OFF_LEGEND_TEXT = "выходной";

export type DaysOff = { closed: ReadonlySet<string>; partial: ReadonlySet<string> };

/**
 * Days (of `days`) fully covered by time off, and days only partly covered, in the master's zone.
 * A period ends exclusively, so it closes a day when it starts at or before 00:00 and reaches the next 00:00.
 */
export function daysOff(
  periods: readonly TimeOffPeriod[],
  days: readonly string[],
  timeZone: string,
): DaysOff {
  const closed = new Set<string>();
  const partial = new Set<string>();
  for (const period of periods) {
    const startDay = localDay(period.start, timeZone);
    const beforeStartDay = localDay(new Date(period.start.getTime() - 1), timeZone);
    const endDay = localDay(period.end, timeZone);
    const lastDay = localDay(new Date(period.end.getTime() - 1), timeZone);
    for (const day of days) {
      if (beforeStartDay < day && endDay > day) closed.add(day);
      else if (startDay <= day && lastDay >= day) partial.add(day);
    }
  }
  for (const day of closed) partial.delete(day);
  return { closed, partial };
}

/** Appointments the calendar shows and counts: everything except cancelled. */
export function shownAppointments(list: readonly Appointment[]): Appointment[] {
  return list.filter((a) => a.status !== "cancelled");
}

/** Number of shown appointments per local day (YYYY-MM-DD). */
export function dayCounts(
  appointments: readonly Appointment[],
  timeZone: string,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const a of shownAppointments(appointments)) {
    const day = localDay(a.start, timeZone);
    counts[day] = (counts[day] ?? 0) + 1;
  }
  return counts;
}

/** Shown appointments of one local day, earliest first. */
export function appointmentsOfDay(
  appointments: readonly Appointment[],
  day: string,
  timeZone: string,
): Appointment[] {
  return shownAppointments(appointments)
    .filter((a) => localDay(a.start, timeZone) === day)
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** Appointment rows with a free row for every long enough gap (when `withFree`). */
export function calendarRows(
  dayAppointments: readonly Appointment[],
  withFree: boolean,
): TodayRow[] {
  const rows: TodayRow[] = [];
  let latestEnd: Date | null = null;
  for (const appointment of dayAppointments) {
    if (
      withFree &&
      latestEnd !== null &&
      minutesBetween(latestEnd, appointment.start) >= FREE_GAP_MIN_MINUTES
    ) {
      rows.push({ kind: "free", start: latestEnd, end: appointment.start });
    }
    rows.push({ kind: "appointment", appointment });
    if (latestEnd === null || appointment.end.getTime() > latestEnd.getTime()) {
      latestEnd = appointment.end;
    }
  }
  return rows;
}

/** "Ноябрь"; with the year ("Январь 2027") when it differs from today's. */
export function monthTitle(day: string, today: string): string {
  const year = day.slice(0, 4);
  const name = MONTHS[Number(day.slice(5, 7)) - 1] ?? "";
  return year === today.slice(0, 4) ? name : `${name} ${year}`;
}

/** "2–8 ноября" or "30 ноября – 6 декабря"; works for any day list (a week or a month: "1–30 ноября"). */
export function rangeLabel(days: readonly string[]): string {
  const first = days[0] ?? "";
  const last = days[days.length - 1] ?? first;
  const end = formatDayMonth(dayDate(last), "UTC");
  if (first.slice(0, 7) === last.slice(0, 7)) {
    return `${Number(first.slice(8, 10))}–${end}`;
  }
  return `${formatDayMonth(dayDate(first), "UTC")} – ${end}`;
}

/** "Пн" */
export function weekdayShort(day: string): string {
  return WEEKDAYS_SHORT[isoWeekday(day) - 1] ?? "";
}

/** The day to book for when it is inside the booking days (today and the next ones), else null. */
export function bookingDay(selected: string, today: string): string | null {
  return selected >= today && selected <= addDays(today, BOOKING_DAYS - 1) ? selected : null;
}

/** "Записать на пн, 2 ноября" */
export function bookDayLabel(day: string): string {
  return `Записать на ${weekdayShort(day).toLowerCase()}, ${formatDayMonth(dayDate(day), "UTC")}`;
}

/** "Понедельник, 2 ноября" */
export function dayTitle(day: string): string {
  return formatDayTitle(dayDate(day), "UTC");
}

/** "5 записей"; "Свободно" for an empty today/future day, "Записей нет" for a past one or one with partial time off. */
export function daySummary(count: number, past: boolean, off = false, partial = false): string {
  if (off) {
    return count === 0
      ? DAY_OFF_SUMMARY
      : `${DAY_OFF_SUMMARY} · ${count} ${plural(count, "запись", "записи", "записей")}`;
  }
  if (count === 0) return past || partial ? NO_APPOINTMENTS_SUMMARY : "Свободно";
  return `${count} ${plural(count, "запись", "записи", "записей")}`;
}

/** Accessibility label of a week or month cell; without a summary while the count is unknown (loading). */
export function dayCellLabel(
  day: string,
  count: number | undefined,
  past: boolean,
  off = false,
  partial = false,
): string {
  if (count === undefined) return dayTitle(day);
  return `${dayTitle(day)}, ${daySummary(count, past, off, partial)}`;
}

/** Day card title: "Пн, 2 ноября · 5 записей"; only "Пн, 2 ноября" while the count is unknown. */
export function dayCardTitle(
  day: string,
  count: number | undefined,
  past: boolean,
  off = false,
  partial = false,
): string {
  const title = `${weekdayShort(day)}, ${formatDayMonth(dayDate(day), "UTC")}`;
  return count === undefined ? title : `${title} · ${daySummary(count, past, off, partial)}`;
}

/** "Первая в 10:00, свободно 13:00–14:30"; the free part only when a free row exists; null for an empty day. */
export function dayCardLine(
  dayAppointments: readonly Appointment[],
  withFree: boolean,
  timeZone: string,
): string | null {
  const first = dayAppointments[0];
  if (first === undefined) return null;
  const line = `Первая в ${formatTime(first.start, timeZone)}`;
  const free = calendarRows(dayAppointments, withFree).find((row) => row.kind === "free");
  if (free?.kind !== "free") return line;
  return `${line}, свободно ${formatTime(free.start, timeZone)}–${formatTime(free.end, timeZone)}`;
}
