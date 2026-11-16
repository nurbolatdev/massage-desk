import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { formatDayMonthYear } from "@/lib/format";

type Api = ReturnType<typeof createApi>;

export type Client = components["schemas"]["ClientResponse"];

export const CLIENTS_PAGE_SIZE = 50;
export const SEARCH_DELAY_MS = 300;

export const CLIENTS_TITLE = "Клиенты";
export const SEARCH_LABEL = "Поиск клиента";
export const SEARCH_PLACEHOLDER = "Имя или телефон";
export const COLUMN_CLIENT = "Клиент";
export const COLUMN_SINCE = "Клиент с";
export const EMPTY_TITLE = "Клиентов пока нет";
export const EMPTY_TEXT = "Они появятся сами, когда кто-то напишет боту в WhatsApp.";
export const NOT_FOUND_TEXT = "Проверьте имя или ищите по последним цифрам телефона.";
export const LOAD_FAILED = "Не удалось загрузить клиентов";
export const SHOW_MORE = "Показать ещё";
export const MORE_FAILED = "Не удалось загрузить следующих клиентов. Нажмите «Показать ещё», чтобы попробовать снова.";
export const SEARCH_OFFLINE = "Найти клиента можно, когда есть интернет.";

export function notFoundTitle(term: string): string {
  return `По запросу «${term}» ничего нет`;
}

export function fetchClients(api: Api, term: string, offset: number): Promise<Client[]> {
  return unwrap(
    api.GET("/clients", {
      params: {
        query: {
          ...(term ? { q: term } : {}),
          limit: CLIENTS_PAGE_SIZE,
          offset,
        },
      },
    }),
  );
}

/** Next offset for `useInfiniteQuery`, or `undefined` when the last page is short. */
export function nextOffset(
  last: readonly Client[],
  pages: readonly (readonly Client[])[],
): number | undefined {
  if (last.length < CLIENTS_PAGE_SIZE) return undefined;
  return pages.reduce((sum, page) => sum + page.length, 0);
}

/** Flattens pages while deduplicating clients by `id` in first-seen order. */
export function uniqueClients(pages: readonly (readonly Client[])[]): Client[] {
  const seen = new Set<string>();
  const result: Client[] = [];
  for (const page of pages) {
    for (const client of page) {
      if (seen.has(client.id)) continue;
      seen.add(client.id);
      result.push(client);
    }
  }
  return result;
}

export function hasName(client: Pick<Client, "name">): boolean {
  return Boolean(client.name?.trim());
}

export function clientName(client: Pick<Client, "name" | "phone">): string {
  return client.name?.trim() || client.phone;
}

/** First letters of up to two words in uppercase, or `""` when name is blank. */
export function clientInitials(name: string | null): string {
  const trimmed = name?.trim() ?? "";
  if (!trimmed) return "";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => Array.from(word)[0] ?? "")
    .join("")
    .toLocaleUpperCase("ru-RU");
}

/** Calendar day from `createdAt` formatted in the master's local day already in the string. */
export function clientSince(createdAt: string): string {
  return formatDayMonthYear(createdAt.slice(0, 10));
}

export type ClientsView = "loading" | "error" | "empty" | "notFound" | "list";

/** Picks the body state for the clients page; existing data takes precedence over background errors. */
export function clientsView({
  hasData,
  error,
  count,
  term,
}: {
  hasData: boolean;
  error: unknown;
  count: number;
  term: string;
}): ClientsView {
  if (!hasData) return error == null ? "loading" : "error";
  if (count === 0) return term ? "notFound" : "empty";
  return "list";
}
