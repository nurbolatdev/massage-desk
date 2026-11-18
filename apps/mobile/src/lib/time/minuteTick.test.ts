import { describe, expect, it } from "@jest/globals";

import { msUntilNextMinute } from "./minuteTick";

describe("msUntilNextMinute", () => {
  it("returns a full minute on a boundary", () => {
    expect(msUntilNextMinute(new Date("2026-11-02T10:00:00.000Z"))).toBe(60000);
  });

  it("returns the remainder inside the minute", () => {
    expect(msUntilNextMinute(new Date("2026-11-02T10:00:30.000Z"))).toBe(30000);
    expect(msUntilNextMinute(new Date("2026-11-02T10:00:59.999Z"))).toBe(1);
  });

  it("always stays within 1..60000", () => {
    for (let ms = 0; ms < 120_000; ms += 997) {
      const result = msUntilNextMinute(new Date(Date.UTC(2026, 10, 2, 10, 0, 0, 0) + ms));
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(60000);
    }
  });
});
