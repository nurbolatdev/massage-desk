import { formatDayMonth, formatDayTitle, plural } from "@/lib/format";
import type { Appointment } from "@/types";

import { dayDate, isoWeekday, localDay } from "./days";
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
export const EMPTY_DAY_TEXT = "На этот день записей нет";

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

/** "2–8 ноября" or "30 ноября – 6 декабря". */
export function weekRangeLabel(days: readonly string[]): string {
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

/** "Понедельник, 2 ноября" */
export function dayTitle(day: string): string {
  return formatDayTitle(dayDate(day), "UTC");
}

/** "5 записей"; "Свободно" for an empty today/future day, "Записей нет" for a past one. */
export function daySummary(count: number, past: boolean): string {
  if (count === 0) return past ? "Записей нет" : "Свободно";
  return `${count} ${plural(count, "запись", "записи", "записей")}`;
}

/** Accessibility label of a week-strip cell. */
export function dayCellLabel(day: string, count: number, past: boolean): string {
  return `${dayTitle(day)}, ${daySummary(count, past)}`;
}
