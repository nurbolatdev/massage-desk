import { describe, expect, it } from "vitest";
import { isActiveStatus, SlotsQuery } from "./index.js";

describe("domain", () => {
  it("only confirmed and done appointments occupy time", () => {
    expect(isActiveStatus("confirmed")).toBe(true);
    expect(isActiveStatus("done")).toBe(true);
    expect(isActiveStatus("cancelled")).toBe(false);
    expect(isActiveStatus("no_show")).toBe(false);
  });
  it("validates slots query", () => {
    expect(SlotsQuery.safeParse({ serviceId: "00000000-0000-4000-8000-000000000002", day: "2026-11-02" }).success).toBe(true);
    expect(SlotsQuery.safeParse({ serviceId: "x", day: "02.11.2026" }).success).toBe(false);
  });
});
