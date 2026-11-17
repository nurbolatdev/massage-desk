import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { formatDayMonthYear } from "@/lib/format";

type Api = ReturnType<typeof createApi>;

export type Client = components["schemas"]["ClientResponse"];
export type ClientListItem = components["schemas"]["ClientListItem"];
export type ClientSegment = "regular" | "lapsed" | "no_shows";
export type SegmentFilter = "all" | ClientSegment;

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

export const PROFILE_LABEL = "Карточка клиента";
export const PICK_CLIENT = "Нажмите на имя клиента в списке — здесь появится его карточка.";
export const NOTE_FIELD_LABEL = "Заметка";
export const NOTE_SAVE_LABEL = "Сохранить";
export const NOTE_SAVED = "Заметка сохранена.";
export const NOTE_SAVE_FAILED =
  "Не получилось сохранить заметку. Проверьте интернет и попробуйте ещё раз.";
export const NOTE_SAVE_OFFLINE = "Сохранить заметку можно, когда есть интернет.";
export const NOTE_LOAD_FAILED = "Не получилось загрузить заметку.";
export const NOTE_OFFLINE = "Заметка появится, когда будет интернет.";
export const NOTE_MAX_LENGTH = 2000;

export function notFoundTitle(term: string): string {
  return `По запросу «${term}» ничего нет`;
}

export function fetchClients(
  api: Api,
  term: string,
  segment: SegmentFilter,
  offset: number,
): Promise<ClientListItem[]> {
  return unwrap(
    api.GET("/clients", {
      params: {
        query: {
          ...(term ? { q: term } : {}),
          ...(segment !== "all" ? { segment } : {}),
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

/** Flattens pages while deduplicating rows by `id` in first-seen order. */
export function uniqueById<T extends { id: string }>(pages: readonly (readonly T[])[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const page of pages) {
    for (const row of page) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      result.push(row);
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

export function fetchClient(api: Api, id: string): Promise<Client> {
  return unwrap(api.GET("/clients/{id}", { params: { path: { id } } }));
}

export function saveClientNote(api: Api, id: string, notes: string): Promise<Client> {
  return unwrap(api.PATCH("/clients/{id}", { params: { path: { id } }, body: { notes } }));
}

/** Merges the client into the matching row of every page; other rows stay by reference and keep their extra fields. */
export function replaceInPages<T extends Client>(
  pages: readonly (readonly T[])[],
  client: Client,
): T[][] {
  return pages.map((page) => page.map((row) => (row.id === client.id ? { ...row, ...client } : row)));
}

export function clientSinceText(createdAt: string): string {
  return `${COLUMN_SINCE} ${clientSince(createdAt)}`;
}

export function noteSaveErrorText(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === "network") return NOTE_SAVE_FAILED;
    if (error.status !== undefined) {
      return `Сервер ответил с ошибкой. Код: ${error.status}. Заметка не сохранена.`;
    }
  }
  return "Заметка не сохранена. Попробуйте ещё раз через минуту.";
}

export type BlockView = "loading" | "error" | "offline" | "ready";

/** Picks the body state for a client card block; cached data beats errors and offline pauses. */
export function blockView({
  hasData,
  error,
  paused,
}: {
  hasData: boolean;
  error: unknown;
  paused: boolean;
}): BlockView {
  if (hasData) return "ready";
  if (error != null) return "error";
  if (paused) return "offline";
  return "loading";
}
