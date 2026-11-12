import { describe, expect, it } from "@jest/globals";

import { workingWindowsOfDay } from "./workingHours";

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
