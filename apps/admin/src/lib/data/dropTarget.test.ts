import { zonedTime } from "@massage-desk/shared";
import { describe, expect, it } from "vitest";

import { canReschedule, dropTarget } from "./dropTarget";
import type { Appointment } from "./schedule";

const TZ = "Asia/Tashkent";
const WEEK = [
  "2026-11-02",
  "2026-11-03",
  "2026-11-04",
  "2026-11-05",
  "2026-11-06",
  "2026-11-07",
  "2026-11-08",
];
const RANGE = { start: 9, end: 19 };
const STEP = { x: 100, y: 14 };

function appointment(day: string, from: string, to: string, status: Appointment["status"] = "confirmed"): Appointment {
  return {
    id: "a1",
    clientId: "c1",
    clientName: "Марат Каримов",
    clientPhone: "+77010000000",
    serviceId: "s1",
    serviceName: "Общий",
    start: zonedTime(day, from, TZ),
    end: zonedTime(day, to, TZ),
    status,
    source: "manual",
  };
}

const marat = appointment("2026-11-02", "16:00", "17:00");

describe("canReschedule", () => {
  it("allows only confirmed appointments", () => {
    expect(canReschedule(marat)).toBe(true);
    expect(canReschedule(appointment("2026-11-02", "16:00", "17:00", "cancelled"))).toBe(false);
    expect(canReschedule(appointment("2026-11-02", "16:00", "17:00", "done"))).toBe(false);
    expect(canReschedule(appointment("2026-11-02", "16:00", "17:00", "no_show"))).toBe(false);
  });
});

describe("dropTarget", () => {
  it("moves vertically and across days by grid step", () => {
    expect(dropTarget({ appointment: marat, days: WEEK, range: RANGE, timeZone: TZ, dx: 0, dy: 56, step: STEP })).toEqual(
      zonedTime("2026-11-02", "17:00", TZ),
    );
    expect(dropTarget({ appointment: marat, days: WEEK, range: RANGE, timeZone: TZ, dx: 0, dy: -28, step: STEP })).toEqual(
      zonedTime("2026-11-02", "15:30", TZ),
    );
    expect(dropTarget({ appointment: marat, days: WEEK, range: RANGE, timeZone: TZ, dx: 300, dy: 0, step: STEP })).toEqual(
      new Date("2026-11-05T11:00:00Z"),
    );
    expect(dropTarget({ appointment: marat, days: WEEK, range: RANGE, timeZone: TZ, dx: 300, dy: 14, step: STEP })).toEqual(
      zonedTime("2026-11-05", "16:15", TZ),
    );
  });

  it("ignores sub-half-step drags and rounds past half-step", () => {
    expect(dropTarget({ appointment: marat, days: WEEK, range: RANGE, timeZone: TZ, dx: 40, dy: 6, step: STEP })).toBeNull();
    expect(dropTarget({ appointment: marat, days: WEEK, range: RANGE, timeZone: TZ, dx: 0, dy: 8, step: STEP })).toEqual(
      zonedTime("2026-11-02", "16:15", TZ),
    );
  });

  it("clamps within visible hours and week bounds", () => {
    expect(dropTarget({ appointment: marat, days: WEEK, range: RANGE, timeZone: TZ, dx: 0, dy: -1000, step: STEP })).toEqual(
      zonedTime("2026-11-02", "09:00", TZ),
    );
    expect(dropTarget({ appointment: marat, days: WEEK, range: RANGE, timeZone: TZ, dx: 0, dy: 1000, step: STEP })).toEqual(
      zonedTime("2026-11-02", "18:00", TZ),
    );
    const thu = appointment("2026-11-05", "16:00", "17:00");
    expect(dropTarget({ appointment: thu, days: WEEK, range: RANGE, timeZone: TZ, dx: -500, dy: 0, step: STEP })).toEqual(
      zonedTime("2026-11-02", "16:00", TZ),
    );
    expect(dropTarget({ appointment: marat, days: WEEK, range: RANGE, timeZone: TZ, dx: 5000, dy: 0, step: STEP })).toEqual(
      zonedTime("2026-11-08", "16:00", TZ),
    );
  });

  it("keeps the same day in day view and ignores pure horizontal drag", () => {
    const dayOnly = ["2026-11-02"];
    expect(dropTarget({ appointment: marat, days: dayOnly, range: RANGE, timeZone: TZ, dx: 300, dy: 14, step: STEP })).toEqual(
      zonedTime("2026-11-02", "16:15", TZ),
    );
    expect(dropTarget({ appointment: marat, days: dayOnly, range: RANGE, timeZone: TZ, dx: 300, dy: 0, step: STEP })).toBeNull();
  });

  it("snaps off-grid appointments to 15-minute slots", () => {
    const offGrid = appointment("2026-11-02", "10:10", "11:00");
    expect(dropTarget({ appointment: offGrid, days: WEEK, range: RANGE, timeZone: TZ, dx: 0, dy: 14, step: STEP })).toEqual(
      zonedTime("2026-11-02", "10:30", TZ),
    );
  });

  it("returns null for invalid layout, out-of-range days, oversized duration, or unchanged clamped time", () => {
    const outsideDay = appointment("2026-11-09", "16:00", "17:00");
    expect(dropTarget({ appointment: outsideDay, days: WEEK, range: RANGE, timeZone: TZ, dx: 0, dy: 14, step: STEP })).toBeNull();
    expect(
      dropTarget({ appointment: marat, days: WEEK, range: RANGE, timeZone: TZ, dx: 0, dy: 14, step: { x: 100, y: 0 } }),
    ).toBeNull();
    const ninetyMin = appointment("2026-11-02", "09:00", "10:30");
    expect(
      dropTarget({ appointment: ninetyMin, days: WEEK, range: { start: 9, end: 10 }, timeZone: TZ, dx: 0, dy: 14, step: STEP }),
    ).toBeNull();
    const atStart = appointment("2026-11-02", "09:00", "10:00");
    expect(
      dropTarget({ appointment: atStart, days: WEEK, range: RANGE, timeZone: TZ, dx: 0, dy: -28, step: STEP }),
    ).toBeNull();
  });
});
