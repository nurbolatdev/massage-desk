import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { dayDate } from "@massage-desk/shared";
import { formatDayMonthAbbr, formatDayMonthYear, NBSP, plural } from "@/lib/format";

import { STATUS_TEXT } from "./calendar";

type Api = ReturnType<typeof createApi>;

export type ClientStats = components["schemas"]["ClientStatsResponse"];
export type HistoryItem = components["schemas"]["AppointmentListItem"];

export const HISTORY_PAGE_SIZE = 10;

export const SPENT_LABEL = "всего";
export const INTERVAL_LABEL = "ходит раз в";
export const NO_VALUE = "—";
export const HISTORY_TITLE = "История";
export const HISTORY_PLANNED = "Запланирована";
export const HISTORY_NOW = "Идёт";
export const STATS_LOAD_FAILED = "Не получилось загрузить статистику.";
export const STATS_OFFLINE = "Статистика появится, когда будет интернет.";
export const HISTORY_LOAD_FAILED = "Не получилось загрузить историю.";
export const HISTORY_OFFLINE = "История появится, когда будет интернет.";
export const HISTORY_EMPTY = "Записей пока нет.";
export const HISTORY_MORE_FAILED =
  "Не получилось загрузить следующие записи. Нажмите «Показать ещё», чтобы попробовать снова.";

export function fetchClientStats(api: Api, id: string): Promise<ClientStats> {
  return unwrap(api.GET("/clients/{id}/stats", { params: { path: { id } } }));
}

export function fetchClientHistory(api: Api, id: string, offset: number): Promise<HistoryItem[]> {
  return unwrap(
    api.GET("/clients/{clientId}/appointments", {
      params: { path: { clientId: id }, query: { limit: HISTORY_PAGE_SIZE, offset } },
    }),
  );
}

/** Next offset for `useInfiniteQuery`, or `undefined` when the last page is short. */
export function nextHistoryOffset(
  last: readonly HistoryItem[],
  pages: readonly (readonly HistoryItem[])[],
): number | undefined {
  if (last.length < HISTORY_PAGE_SIZE) return undefined;
  return pages.reduce((sum, page) => sum + page.length, 0);
}

export function visitsLabel(n: number): string {
  return plural(n, "визит", "визита", "визитов");
}

const compact = new Intl.NumberFormat("ru-RU", { notation: "compact" });

export function formatSpent(amount: number): string {
  return amount === 0 ? NO_VALUE : compact.format(amount);
}

export function formatInterval(days: number | null): string {
  if (days === null) return NO_VALUE;
  if (days < 7) return `${days}${NBSP}дн.`;
  if (days < 60) return `${Math.round(days / 7)}${NBSP}нед.`;
  return `${Math.round(days / 30)}${NBSP}мес.`;
}

/** Day of `start` (already in the master's zone); the year is shown only when it differs from `year`. */
export function historyDay(start: string, year: number): string {
  const day = start.slice(0, 10);
  return dayDate(day).getUTCFullYear() === year ? formatDayMonthAbbr(day) : formatDayMonthYear(day);
}

export type HistoryTone = "done" | "planned" | "missed" | "cancelled";

export function historyStatus(
  item: Pick<HistoryItem, "status" | "start" | "end">,
  now: Date,
): { text: string; tone: HistoryTone } {
  switch (item.status) {
    case "done":
      return { text: STATUS_TEXT.done, tone: "done" };
    case "no_show":
      return { text: STATUS_TEXT.no_show, tone: "missed" };
    case "cancelled":
      return { text: STATUS_TEXT.cancelled, tone: "cancelled" };
    case "confirmed": {
      if (new Date(item.end) <= now) return { text: STATUS_TEXT.done, tone: "done" };
      if (new Date(item.start) <= now) return { text: HISTORY_NOW, tone: "planned" };
      return { text: HISTORY_PLANNED, tone: "planned" };
    }
  }
}
