import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";

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

/** Whole days `from`..`to` (inclusive) as UTC instants: local midnight to the next local midnight. */
export function dayRangePeriod(from: string, to: string, timeZone: string) {
  return {
    start: zonedTime(from, "00:00", timeZone).toISOString(),
    end: zonedTime(addDays(to, 1), "00:00", timeZone).toISOString(),
  };
}
