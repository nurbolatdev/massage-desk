import { describe, expect, it } from "@jest/globals";

import { addDays, dayDate, isDay, isoWeekday, localDay, nextDay, weekDays } from "./days";

describe("localDay", () => {
  it("uses the master's zone, not UTC", () => {
    expect(localDay(new Date("2026-11-02T18:59:00Z"), "Asia/Tashkent")).toBe("2026-11-02");
    expect(localDay(new Date("2026-11-02T19:00:00Z"), "Asia/Tashkent")).toBe("2026-11-03");
  });

  it("handles a DST change", () => {
    // Europe/Berlin leaves summer time on 2026-10-25 (02:00 -> 01:00 local).
    expect(localDay(new Date("2026-10-24T22:30:00Z"), "Europe/Berlin")).toBe("2026-10-25");
    expect(localDay(new Date("2026-10-25T22:30:00Z"), "Europe/Berlin")).toBe("2026-10-25");
    expect(localDay(new Date("2026-10-25T23:00:00Z"), "Europe/Berlin")).toBe("2026-10-26");
  });
});

describe("nextDay", () => {
  it("moves to the next calendar day", () => {
    expect(nextDay("2026-11-02")).toBe("2026-11-03");
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
    expect(nextDay("2026-12-31")).toBe("2027-01-01");
    expect(nextDay("2028-02-28")).toBe("2028-02-29");
  });
});

describe("isDay", () => {
  it("accepts a real day", () => {
    expect(isDay("2026-11-02")).toBe(true);
  });

  it("rejects malformed or impossible days", () => {
    expect(isDay("")).toBe(false);
    expect(isDay("2026-11-2")).toBe(false);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("abc")).toBe(false);
  });
});

describe("addDays", () => {
  it("moves forward and backward", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2026-11-02", 7)).toBe("2026-11-09");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("isoWeekday", () => {
  it("counts Monday as 1 and Sunday as 7", () => {
    expect(isoWeekday("2026-11-02")).toBe(1);
    expect(isoWeekday("2026-11-08")).toBe(7);
  });
});

describe("weekDays", () => {
  it("returns Monday to Sunday around the day", () => {
    const week = weekDays("2026-11-04");
    expect(week).toHaveLength(7);
    expect(week[0]).toBe("2026-11-02");
    expect(week[6]).toBe("2026-11-08");
  });

  it("starts a Sunday's week on the previous Monday", () => {
    expect(weekDays("2026-11-08")[0]).toBe("2026-11-02");
  });

  it("crosses a year boundary", () => {
    const week = weekDays("2026-12-31");
    expect(week[0]).toBe("2026-12-28");
    expect(week[6]).toBe("2027-01-03");
  });
});

describe("dayDate", () => {
  it("is noon UTC", () => {
    expect(dayDate("2026-11-02").toISOString()).toBe("2026-11-02T12:00:00.000Z");
  });
});
