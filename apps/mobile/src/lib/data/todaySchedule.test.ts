import { describe, expect, it } from "@jest/globals";

import type { Appointment } from "@/types";

import { tomorrowSummary } from "./todaySchedule";

function appt(start: string, status: Appointment["status"] = "confirmed"): Appointment {
  return {
    id: start,
    clientName: "Клиент",
    clientPhone: "+998900000000",
    serviceName: "Массаж",
    start: new Date(start),
    end: new Date(start),
    status,
    source: "bot",
  };
}

describe("tomorrowSummary", () => {
  it("is null for an empty list or only cancelled", () => {
    expect(tomorrowSummary([])).toBeNull();
    expect(tomorrowSummary([appt("2026-11-03T04:00:00Z", "cancelled")])).toBeNull();
  });

  it("counts confirmed only and finds the earliest start in unsorted input", () => {
    const result = tomorrowSummary([
      appt("2026-11-03T08:00:00Z"),
      appt("2026-11-03T03:00:00Z", "cancelled"),
      appt("2026-11-03T05:00:00Z"),
    ]);
    expect(result).toEqual({ count: 2, first: new Date("2026-11-03T05:00:00Z") });
  });
});
