import { describe, expect, it } from "vitest";

import { safeRedirect } from "./redirect";

describe("safeRedirect", () => {
  it.each([["/clients"], ["/clients?q=1"]])("keeps %s", (path) => {
    expect(safeRedirect(path)).toBe(path);
  });

  it.each([
    [undefined],
    [""],
    ["clients"],
    ["//evil.com"],
    ["/\\evil.com"],
    ["/\t/evil.com"],
    ["/a b"],
    ["https://evil.com"],
    ["/sign-in"],
    ["/sign-in?redirect=/x"],
    [42],
  ])("falls back to / for %j", (target) => {
    expect(safeRedirect(target)).toBe("/");
  });
});
