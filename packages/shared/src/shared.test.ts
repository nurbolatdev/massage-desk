import { describe, expect, it } from "vitest";
import { isActiveStatus, normalizePhone, SlotsQuery, toWhatsAppId } from "./index.js";

describe("normalizePhone", () => {
  it("accepts WhatsApp format and typed format", () => {
    expect(normalizePhone("998901234567")).toBe("+998901234567");
    expect(normalizePhone("+998 (90) 123-45-67")).toBe("+998901234567");
  });
  it("rejects garbage", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("привет")).toBeNull();
  });
  it("converts to WhatsApp id", () => {
    expect(toWhatsAppId("+998901234567")).toBe("998901234567");
  });
});

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
