import { describe, expect, it } from "@jest/globals";

import { formatTime } from "./format";

describe("formatTime", () => {
  it("formats in the given zone", () => {
    expect(formatTime(new Date("2026-11-03T05:00:00Z"), "Asia/Tashkent")).toBe("10:00");
  });
});
