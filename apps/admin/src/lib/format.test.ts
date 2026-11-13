import { describe, expect, it } from "vitest";

import { formatDayMonth, formatDayMonthShort, formatTime, plural } from "./format";

const TZ = "Asia/Tashkent";

describe("formatTime", () => {
  it("shows the time in the master's zone without a leading zero", () => {
    expect(formatTime(new Date("2026-11-03T04:00:00Z"), TZ)).toBe("9:00");
    expect(formatTime(new Date("2026-11-03T05:30:00Z"), TZ)).toBe("10:30");
  });
});

describe("day formats", () => {
  it("formats a day and a short date", () => {
    expect(formatDayMonth("2026-11-08")).toBe("8 ноября");
    expect(formatDayMonthShort(new Date("2026-11-02T05:00:00Z"), TZ)).toBe("2 нояб.");
  });
});

describe("plural", () => {
  it("picks the Russian form", () => {
    const form = (n: number) => plural(n, "запись", "записи", "записей");
    expect([1, 3, 5, 11, 21].map(form)).toEqual(["запись", "записи", "записей", "записей", "запись"]);
  });
});
