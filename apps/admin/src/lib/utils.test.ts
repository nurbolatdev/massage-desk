import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("keeps a text size and a text colour together", () => {
    expect(cn("text-body text-ink")).toBe("text-body text-ink");
  });

  it("lets the later padding win", () => {
    expect(cn("p-12", "p-16")).toBe("p-16");
  });

  it("lets the later text size win", () => {
    expect(cn("text-body", "text-title")).toBe("text-title");
  });

  it("drops falsy values", () => {
    expect(cn("p-12", false, undefined, "m-8")).toBe("p-12 m-8");
  });
});
