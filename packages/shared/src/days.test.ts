import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  dayDate,
  isDay,
  isoWeekday,
  localDay,
  monthDays,
  monthGrid,
  nextDay,
  weekDays,
  workingWindowsOfDay,
  zonedTime,
} from "./index.js";

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

describe("addMonths", () => {
  it("clamps to the length of the target month", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(addMonths("2028-03-31", -1)).toBe("2028-02-29");
  });

  it("keeps the day number and crosses years", () => {
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
    expect(addMonths("2026-11-04", -1)).toBe("2026-10-04");
    expect(addMonths("2026-01-10", -1)).toBe("2025-12-10");
  });
});

describe("monthDays", () => {
  it("lists the whole month", () => {
    const days = monthDays("2026-11-17");
    expect(days).toHaveLength(30);
    expect(days[0]).toBe("2026-11-01");
    expect(days[29]).toBe("2026-11-30");
    expect(monthDays("2028-02-03")).toHaveLength(29);
  });
});

describe("monthGrid", () => {
  it("pads a month that starts on Sunday-adjacent days with nulls", () => {
    const grid = monthGrid("2026-11-17");
    expect(grid).toHaveLength(42);
    expect(grid.slice(0, 6).every((c) => c === null)).toBe(true);
    expect(grid[6]).toBe("2026-11-01");
    expect(grid[35]).toBe("2026-11-30");
    expect(grid.slice(36).every((c) => c === null)).toBe(true);
    expect(grid.slice(36)).toHaveLength(6);
  });

  it("has four rows and no padding for a February starting on Monday", () => {
    const grid = monthGrid("2027-02-10");
    expect(grid).toHaveLength(28);
    expect(grid.includes(null)).toBe(false);
    expect(grid[0]).toBe("2027-02-01");
    expect(grid[27]).toBe("2027-02-28");
  });

  it("uses six rows for a month starting on Sunday", () => {
    expect(monthGrid("2026-03-05")).toHaveLength(42);
  });
});

describe("zonedTime", () => {
  it("converts a local time to an instant", () => {
    expect(zonedTime("2026-11-04", "13:00", "Asia/Tashkent").toISOString()).toBe("2026-11-04T08:00:00.000Z");
    expect(zonedTime("2026-11-04", "09:00", "America/New_York").toISOString()).toBe("2026-11-04T14:00:00.000Z");
  });

  it("handles DST changes", () => {
    expect(zonedTime("2026-03-28", "10:00", "Europe/Berlin").toISOString()).toBe("2026-03-28T09:00:00.000Z");
    expect(zonedTime("2026-03-29", "10:00", "Europe/Berlin").toISOString()).toBe("2026-03-29T08:00:00.000Z");
    expect(zonedTime("2026-10-25", "10:00", "Europe/Berlin").toISOString()).toBe("2026-10-25T09:00:00.000Z");
  });

  it("gives the local midnight of the day", () => {
    expect(zonedTime("2026-11-04", "00:00", "Asia/Tashkent").toISOString()).toBe("2026-11-03T19:00:00.000Z");
  });
});

const blocks = [
  { weekday: 3, start: "14:00", end: "19:00" },
  { weekday: 3, start: "09:00", end: "13:00" },
  { weekday: 4, start: "09:00", end: "18:00" },
];

describe("workingWindowsOfDay", () => {
  it("keeps the blocks of the weekday, sorted, as instants", () => {
    const windows = workingWindowsOfDay(blocks, "2026-11-04", "Asia/Tashkent");
    expect(windows.map((w) => [w.start.toISOString(), w.end.toISOString()])).toEqual([
      ["2026-11-04T04:00:00.000Z", "2026-11-04T08:00:00.000Z"],
      ["2026-11-04T09:00:00.000Z", "2026-11-04T14:00:00.000Z"],
    ]);
    expect(workingWindowsOfDay(blocks, "2026-11-05", "Asia/Tashkent")).toHaveLength(1);
  });

  it("is empty for a weekday without blocks", () => {
    expect(workingWindowsOfDay(blocks, "2026-11-03", "Asia/Tashkent")).toEqual([]);
  });
});
