import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";

import { isoWeekday, zonedTime } from "./days";

export type WorkingBlock = components["schemas"]["WorkingBlock"];
export type WorkingHours = components["schemas"]["WorkingHoursResponse"];

/** A working period of one day; `end` is exclusive. */
export type WorkingWindow = { start: Date; end: Date };

export function fetchWorkingHours(api: ReturnType<typeof createApi>): Promise<WorkingHours> {
  return unwrap(api.GET("/working-hours"));
}

/** The working windows of `day` in the master's zone, ordered by start. */
export function workingWindowsOfDay(
  blocks: readonly WorkingBlock[],
  day: string,
  timeZone: string,
): WorkingWindow[] {
  const weekday = isoWeekday(day);
  return blocks
    .filter((block) => block.weekday === weekday)
    .map((block) => ({
      start: zonedTime(day, block.start, timeZone),
      end: zonedTime(day, block.end, timeZone),
    }))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}
