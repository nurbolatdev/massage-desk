import { describe, expect, it } from "@jest/globals";

import { localDay } from "./days";

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
