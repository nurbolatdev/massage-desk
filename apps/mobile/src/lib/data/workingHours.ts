import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";

export type WorkingBlock = components["schemas"]["WorkingBlock"];
export type WorkingHours = components["schemas"]["WorkingHoursResponse"];

export function fetchWorkingHours(api: ReturnType<typeof createApi>): Promise<WorkingHours> {
  return unwrap(api.GET("/working-hours"));
}

export { workingWindowsOfDay } from "@massage-desk/shared";
export type { WorkingWindow } from "@massage-desk/shared";
