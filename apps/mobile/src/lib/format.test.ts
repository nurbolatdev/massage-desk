import { describe, expect, it } from "@jest/globals";

import { formatDayTitle, formatTime } from "./format";

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
