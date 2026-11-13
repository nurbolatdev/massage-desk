import { formatTime } from "@/lib/format";

import { addDays, localDay, zonedTime } from "./days";
import type { TimeOffPeriod } from "./timeOff";
import { timeOffKind, timeOffTitle } from "./timeOffForm";

export const TIME_OFF_LIST_TITLE = "Отпуск и отгулы";
export const ADD_DATES_LABEL = "Добавить даты";
export const TIME_OFF_EMPTY_TEXT =
  "Пока ничего не задано. Нажмите «Добавить даты», чтобы отметить выходной или отпуск.";
export const TIME_OFF_LIST_OFFLINE_EMPTY_TEXT =
  "Выходные и отпуск появятся, когда телефон подключится к интернету.";
export const TIME_OFF_LIST_OFFLINE_TEXT =
  "Удалить или добавить дни можно, когда телефон подключится к интернету.";
export const TIME_OFF_SUMMARY_EMPTY = "Отпуск не задан";

// The list request covers at most 366 days; a period can start up to 730 days ahead (731 around midnight).
export const UPCOMING_FIRST_DAYS = 365;
export const UPCOMING_LAST_DAY = 731;

export type DayWindow = { from: string; to: string };

/** Two windows that together cover every period the server can hold. */
export function upcomingWindows(today: string): [DayWindow, DayWindow] {
  return [
    { from: today, to: addDays(today, UPCOMING_FIRST_DAYS) },
    { from: addDays(today, UPCOMING_FIRST_DAYS + 1), to: addDays(today, UPCOMING_LAST_DAY) },
  ];
}

/** Merges the windows' answers by id, keeps periods that have not ended, orders by start. */
export function upcomingPeriods(
  lists: (TimeOffPeriod[] | undefined)[],
  now: Date,
): TimeOffPeriod[] | undefined {
  const byId = new Map<string, TimeOffPeriod>();
  for (const list of lists) {
    if (list === undefined) return undefined;
    for (const period of list) byId.set(period.id, period);
  }
  return [...byId.values()]
    .filter((p) => p.end.getTime() > now.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export type PeriodView = {
  id: string;
  title: string;
  kind: string;
  word: "Выходной" | "Отпуск" | "Отгул";
};

export function periodView(period: TimeOffPeriod, timeZone: string): PeriodView {
  const from = localDay(period.start, timeZone);
  const to = localDay(new Date(period.end.getTime() - 1), timeZone);
  const title = timeOffTitle(from, to);
  const whole =
    period.start.getTime() === zonedTime(from, "00:00", timeZone).getTime() &&
    period.end.getTime() === zonedTime(addDays(to, 1), "00:00", timeZone).getTime();
  if (!whole) {
    const range = `${formatTime(period.start, timeZone)} – ${formatTime(period.end, timeZone)}`;
    return { id: period.id, title, kind: `Отгул · ${range}`, word: "Отгул" };
  }
  return { id: period.id, title, kind: timeOffKind(from, to), word: from === to ? "Выходной" : "Отпуск" };
}

/** The Settings row's second line; undefined while the data is unknown. */
export function timeOffSummary(views: PeriodView[] | undefined): string | undefined {
  if (views === undefined) return undefined;
  const [nearest] = views;
  if (nearest === undefined) return TIME_OFF_SUMMARY_EMPTY;
  const more = views.length > 1 ? ` и ещё ${views.length - 1}` : "";
  return `${nearest.word} · ${nearest.title}${more}`;
}
