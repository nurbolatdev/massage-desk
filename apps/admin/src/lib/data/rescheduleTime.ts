import { queryOptions } from "@tanstack/react-query";
import type { components } from "@massage-desk/api-types";
import { addDays, isDay } from "@massage-desk/shared";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { loadErrorText } from "./calendar";
import { queryKeys } from "./queryKeys";
import { whenShort } from "./reschedule";
import type { Appointment } from "./schedule";

export type SlotsResponse = components["schemas"]["SlotsResponse"];

/** Fetches free appointment start times for `serviceId` on `day` from the server. */
export function fetchSlots(
  api: ReturnType<typeof createApi>,
  serviceId: string,
  day: string,
): Promise<SlotsResponse> {
  return unwrap(api.GET("/slots", { params: { query: { serviceId, day } } }));
}

const SLOTS_ATTEMPTS = 3;

export function slotsRetry(failureCount: number, error: unknown): boolean {
  // A 4xx answer will not change on repeat.
  if (error instanceof ApiError && error.status !== undefined && error.status >= 400 && error.status < 500) {
    return false;
  }
  return failureCount < SLOTS_ATTEMPTS;
}

export function daySlotsOptions(
  serviceId: string,
  day: string | null,
  load: (serviceId: string, day: string) => Promise<SlotsResponse>,
) {
  return queryOptions({
    queryKey: queryKeys.slots.one(serviceId, day ?? ""),
    queryFn: () => load(serviceId, day ?? ""),
    select: toStarts,
    enabled: day !== null,
    staleTime: 0,
    // A closed picker keeps no times: they may be taken by now.
    gcTime: 0,
    retry: slotsRetry,
  });
}

export function toStarts(res: SlotsResponse): Date[] {
  return res.starts.map((s) => new Date(s));
}

export type DayChoice = "today" | "tomorrow" | "other";

export const DAY_CHOICES: readonly [DayChoice, string][] = [
  ["today", "Сегодня"],
  ["tomorrow", "Завтра"],
  ["other", "Другое число"],
];

export const PICK_TITLE = "Перенос записи";
export const DATE_LABEL = "Дата";
export const TIMES_LABEL = "Свободное время";
export const TIMES_LOADING = "Загружаем свободное время…";
export const TIMES_EMPTY = "В этот день нет свободного времени. Выберите другой день.";
export const TIMES_FAILED = "Не получилось загрузить свободное время.";
export const TIMES_OFFLINE = "Нет связи с сервером. Свободное время появится, когда интернет вернётся.";
export const PICK_DAY_HINT = "Выберите день не раньше сегодняшнего.";
export const SERVICE_HIDDEN =
  "Эта услуга скрыта, поэтому свободное время не считается. Перенесите запись перетаскиванием в календаре.";
export const PICK_CANCEL = "Не переносить";
export const RETRY_LABEL = "Повторить";

/** Maps an initial or returned `day` to the matching segment and valid picker date. */
export function dayPick(day: string, today: string): { choice: DayChoice; day: string } {
  if (!isDay(day) || day <= today) return { choice: "today", day: today };
  if (day === addDays(today, 1)) return { choice: "tomorrow", day };
  return { choice: "other", day };
}

/** Resolves the calendar day (YYYY-MM-DD) for a selected day segment. */
export function choiceDay(choice: DayChoice, today: string, otherDay: string): string {
  if (choice === "today") return today;
  if (choice === "tomorrow") return addDays(today, 1);
  return otherDay;
}

export function pickableDay(day: string, today: string): boolean {
  return isDay(day) && day >= today;
}

export type SlotsView = "pickDay" | "offline" | "loading" | "error" | "empty" | "ready";

/** Determines which state the time picker body should render. */
export function slotsView({
  day,
  today,
  online,
  starts,
  error,
}: {
  day: string;
  today: string;
  online: boolean;
  starts: Date[] | undefined;
  error: unknown;
}): SlotsView {
  if (!pickableDay(day, today)) return "pickDay";
  if (!online) return "offline";
  if (starts !== undefined) return starts.length === 0 ? "empty" : "ready";
  if (error != null) return "error";
  return "loading";
}

const STATUS_TEXT: Partial<Record<SlotsView, string>> = {
  loading: TIMES_LOADING,
  empty: TIMES_EMPTY,
  pickDay: PICK_DAY_HINT,
};

/** Status text announced via the picker's persistent live region, or `null` for non-text views. */
export function slotsStatusText(view: SlotsView): string | null {
  return STATUS_TEXT[view] ?? null;
}

function isServiceHidden(error: unknown): boolean {
  return error instanceof ApiError && error.code === "SERVICE_NOT_FOUND";
}

export function slotsErrorText(error: unknown): string {
  return isServiceHidden(error) ? SERVICE_HIDDEN : loadErrorText(error);
}

export function slotsRetryable(error: unknown): boolean {
  return !isServiceHidden(error);
}

/** Subtitle in the day/time picker showing the client and current appointment time. */
export function pickerText(a: Appointment, timeZone: string): string {
  return `${a.clientName}, сейчас ${whenShort(a.start, timeZone)}. Выберите новый день и время.`;
}
