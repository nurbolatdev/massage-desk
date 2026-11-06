import { describe, expect, it } from "@jest/globals";

import type { Appointment } from "@/types";

import { selectNextClient, todaySchedule, tomorrowSummary } from "./todaySchedule";

function appt(start: string, status: Appointment["status"] = "confirmed", end?: string): Appointment {
  return {
    id: start,
    clientName: "Клиент",
    clientPhone: "+998900000000",
    serviceName: "Массаж",
    start: new Date(start),
    end: new Date(end ?? start),
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

const NOW = new Date("2026-11-03T05:00:00Z");

describe("selectNextClient", () => {
  it("chooses an upcoming confirmed appointment", () => {
    const a = appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z");
    expect(selectNextClient([a], NOW)).toBe(a);
  });

  it("chooses an in-progress appointment over a later one", () => {
    const current = appt("2026-11-03T04:30:00Z", "confirmed", "2026-11-03T05:30:00Z");
    const later = appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z");
    expect(selectNextClient([later, current], NOW)).toBe(current);
  });

  it("skips an appointment that ends exactly now", () => {
    expect(selectNextClient([appt("2026-11-03T04:00:00Z", "confirmed", "2026-11-03T05:00:00Z")], NOW)).toBeNull();
  });

  it("skips done, cancelled and no_show even when upcoming", () => {
    const list = (["done", "cancelled", "no_show"] as const).map((status) =>
      appt("2026-11-03T06:00:00Z", status, "2026-11-03T07:00:00Z"),
    );
    expect(selectNextClient(list, NOW)).toBeNull();
  });

  it("gives the earliest for unsorted input", () => {
    const early = appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z");
    const late = appt("2026-11-03T09:00:00Z", "confirmed", "2026-11-03T10:00:00Z");
    const mid = appt("2026-11-03T08:00:00Z", "confirmed", "2026-11-03T08:30:00Z");
    expect(selectNextClient([late, early, mid], NOW)).toBe(early);
  });

  it("is null when nothing is left", () => {
    expect(selectNextClient([], NOW)).toBeNull();
  });
});

describe("todaySchedule", () => {
  it("is empty for [] and for only cancelled", () => {
    expect(todaySchedule([], NOW).kind).toBe("empty");
    expect(todaySchedule([appt("2026-11-03T06:00:00Z", "cancelled", "2026-11-03T07:00:00Z")], NOW).kind).toBe("empty");
  });

  it("is finished when every active appointment has ended", () => {
    const past = appt("2026-11-03T02:00:00Z", "confirmed", "2026-11-03T03:00:00Z");
    expect(todaySchedule([past], NOW).kind).toBe("finished");
  });

  it("is schedule when something is still ahead", () => {
    const next = appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z");
    expect(todaySchedule([next], NOW).kind).toBe("schedule");
  });

  it("laterCount excludes next and non-confirmed appointments", () => {
    const result = todaySchedule(
      [
        appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z"),
        appt("2026-11-03T07:00:00Z", "confirmed", "2026-11-03T08:00:00Z"),
        appt("2026-11-03T08:00:00Z", "cancelled", "2026-11-03T09:00:00Z"),
        appt("2026-11-03T09:00:00Z", "done", "2026-11-03T10:00:00Z"),
      ],
      NOW,
    );
    expect(result.laterCount).toBe(1);
  });

  it("adds a free row for a 90-minute gap before the later appointment", () => {
    const a = appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z");
    const b = appt("2026-11-03T08:30:00Z", "confirmed", "2026-11-03T09:30:00Z");
    const { rows } = todaySchedule([a, b], NOW);
    expect(rows).toEqual([
      { kind: "free", start: a.end, end: b.start },
      { kind: "appointment", appointment: b },
    ]);
  });

  it("adds no free row for 29 minutes and one for exactly 30", () => {
    const a = appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z");
    const short = appt("2026-11-03T07:29:00Z", "confirmed", "2026-11-03T08:00:00Z");
    const exact = appt("2026-11-03T07:30:00Z", "confirmed", "2026-11-03T08:00:00Z");
    expect(todaySchedule([a, short], NOW).rows.map((r) => r.kind)).toEqual(["appointment"]);
    expect(todaySchedule([a, exact], NOW).rows.map((r) => r.kind)).toEqual(["free", "appointment"]);
  });

  it("adds no free row before next", () => {
    const a = appt("2026-11-03T09:00:00Z", "confirmed", "2026-11-03T10:00:00Z");
    const { rows, next } = todaySchedule([a], NOW);
    expect(next).toBe(a);
    expect(rows).toEqual([]);
  });
});
