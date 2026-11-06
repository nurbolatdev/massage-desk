import { describe, expect, it } from "@jest/globals";

import { formatDayMonth, formatDayTitle, formatSpan, formatTime, formatWeekday, plural } from "./format";

describe("formatTime", () => {
  it("formats in the given zone", () => {
    expect(formatTime(new Date("2026-11-03T05:00:00Z"), "Asia/Tashkent")).toBe("10:00");
  });
});

describe("formatDayTitle", () => {
  it("uses the given zone for the day", () => {
    const instant = new Date("2026-11-03T20:00:00Z");
    expect(formatDayTitle(instant, "Asia/Tashkent")).toBe("Среда, 4 ноября");
    expect(formatDayTitle(instant, "UTC")).toBe("Вторник, 3 ноября");
  });
});

describe("plural", () => {
  const f = (n: number) => plural(n, "один", "мало", "много");
  it("picks the Russian form", () => {
    expect([1, 21].map(f)).toEqual(["один", "один"]);
    expect([2, 4, 22].map(f)).toEqual(["мало", "мало", "мало"]);
    expect([0, 5, 11, 12, 14, 25].map(f)).toEqual(Array(6).fill("много"));
  });
});

describe("formatSpan", () => {
  it("formats minutes, hours and halves", () => {
    expect(formatSpan(25)).toBe("25\u00a0мин");
    expect(formatSpan(60)).toBe("1\u00a0час");
    expect(formatSpan(90)).toBe("1,5\u00a0часа");
    expect(formatSpan(120)).toBe("2\u00a0часа");
    expect(formatSpan(300)).toBe("5\u00a0часов");
    expect(formatSpan(75)).toBe("1\u00a0ч 15\u00a0мин");
  });
});

describe("formatWeekday and formatDayMonth", () => {
  const instant = new Date("2026-11-02T05:00:00Z");
  it("name the day in the given zone", () => {
    expect(formatWeekday(instant, "Asia/Tashkent")).toBe("Понедельник");
    expect(formatDayMonth(instant, "Asia/Tashkent")).toBe("2 ноября");
  });
});
