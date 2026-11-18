import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { addDays, zonedTime } from "./days";

export type TimeOffItem = components["schemas"]["TimeOffResponse"];

/** A time off period; `end` is exclusive. */
export type TimeOffPeriod = { id: string; start: Date; end: Date };

export function fetchTimeOff(
  api: ReturnType<typeof createApi>,
  from: string,
  to: string,
): Promise<TimeOffItem[]> {
  return unwrap(api.GET("/time-off", { params: { query: { from, to } } }));
}

/** Maps raw API items to periods, ordered by start. */
export function toTimeOffPeriods(items: TimeOffItem[]): TimeOffPeriod[] {
  return items
    .map((item) => ({ id: item.id, start: new Date(item.start), end: new Date(item.end) }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

export type CreateTimeOffInput = { start: string; end: string; force?: boolean };

export function createTimeOff(
  api: ReturnType<typeof createApi>,
  input: CreateTimeOffInput,
): Promise<TimeOffItem> {
  return unwrap(api.POST("/time-off", { body: input }));
}

/** Removes a period; a period that is already gone counts as removed. */
export async function deleteTimeOff(api: ReturnType<typeof createApi>, id: string): Promise<void> {
  try {
    await unwrap(api.DELETE("/time-off/{id}", { params: { path: { id } } }));
  } catch (error) {
    if (error instanceof ApiError && error.code === "TIME_OFF_NOT_FOUND") return;
    throw error;
  }
}

export function withoutTimeOff(
  items: TimeOffItem[] | undefined,
  id: string,
): TimeOffItem[] | undefined {
  return items?.filter((item) => item.id !== id);
}

/** Whole days `from`..`to` (inclusive) as UTC instants: local midnight to the next local midnight. */
export function dayRangePeriod(from: string, to: string, timeZone: string) {
  return {
    start: zonedTime(from, "00:00", timeZone).toISOString(),
    end: zonedTime(addDays(to, 1), "00:00", timeZone).toISOString(),
  };
}
