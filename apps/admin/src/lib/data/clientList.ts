import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { formatWeekdayDayMonth, NBSP, plural } from "@/lib/format";

import type { ClientSegment, SegmentFilter } from "./clients";
import { historyDay, NO_VALUE } from "./clientVisits";

type Api = ReturnType<typeof createApi>;

export type ClientsSummary = components["schemas"]["ClientsSummaryResponse"];

export const COLUMN_VISITS = "Визитов";
export const COLUMN_LAST = "Последний";
export const COLUMN_NEXT = "Следующая запись";
export const COLUMN_NO_SHOWS = "Неявки";
export const TODAY_LABEL = "сегодня";
export const FILTER_LABEL = "Фильтр";
export const FILTER_OFFLINE = "Выбрать группу клиентов можно, когда есть интернет.";

export const SEGMENT_FILTERS: readonly { value: SegmentFilter; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "regular", label: "Постоянные" },
  { value: "lapsed", label: "Давно не были" },
  { value: "no_shows", label: "С неявками" },
];

export const SEGMENT_EMPTY: Record<ClientSegment, { title: string; text: string }> = {
  regular: {
    title: "Постоянных клиентов пока нет",
    text: "Здесь будут те, кто был 3 раза и больше и приходил за последние 2 месяца или уже записан.",
  },
  lapsed: {
    title: "Все клиенты приходили недавно",
    text: "Здесь будут те, кто не был больше 2 месяцев и не записан.",
  },
  no_shows: {
    title: "Неявок пока не было",
    text: "Здесь будут клиенты, которые хоть раз не пришли на запись.",
  },
};

export function fetchClientsSummary(api: Api): Promise<ClientsSummary> {
  return unwrap(api.GET("/clients/summary"));
}

/** "142 клиента · 9 новых за месяц"; `null` when there are no clients. */
export function summaryText({ total, newLast30Days }: ClientsSummary): string | null {
  if (total === 0) return null;
  const clients = `${total}${NBSP}${plural(total, "клиент", "клиента", "клиентов")}`;
  if (newLast30Days === 0) return clients;
  const fresh = plural(newLast30Days, "новый", "новых", "новых");
  return `${clients} · ${newLast30Days}${NBSP}${fresh} за месяц`;
}

export function lastVisitText(lastVisitAt: string | null, year: number): string {
  return lastVisitAt === null ? NO_VALUE : historyDay(lastVisitAt, year);
}

function clockText(iso: string): string {
  return `${Number(iso.slice(11, 13))}:${iso.slice(14, 16)}`;
}

/** "сегодня, 10:00" or "пн, 2 нояб."; `today` is the master's current day, when known. */
export function nextVisitText(nextAt: string | null, today: string | undefined): string {
  if (nextAt === null) return NO_VALUE;
  const day = nextAt.slice(0, 10);
  if (day === today) return `${TODAY_LABEL}, ${clockText(nextAt)}`;
  return formatWeekdayDayMonth(day);
}

export function noShowsClass(noShows: number): string {
  return noShows > 0 ? "font-bold text-accent-strong" : "font-bold text-muted";
}
