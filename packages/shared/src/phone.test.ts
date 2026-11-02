import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { normalizePhone, toWhatsAppId } from "./index.js";

const Fixture = z.object({
  cases: z.array(
    z.object({
      input: z.string(),
      expected: z.strictObject({ UZ: z.string().nullable(), KZ: z.string().nullable() }),
    }),
  ),
});

const fixture = Fixture.parse(
  JSON.parse(readFileSync(new URL("../fixtures/phones.json", import.meta.url), "utf8")),
);

const rows = fixture.cases.flatMap((c) =>
  (["UZ", "KZ"] as const).map((region) => ({ input: c.input, region, expected: c.expected[region] })),
);

describe("normalizePhone", () => {
  it("has fixture cases", () => {
    expect(fixture.cases.length).toBeGreaterThan(0);
  });
  it.each(rows)("reads '$input' in $region as $expected", ({ input, region, expected }) => {
    expect(normalizePhone(input, region)).toBe(expected);
  });
  it("uses UZ by default", () => {
    expect(normalizePhone("90 123 45 67")).toBe("+998901234567");
  });
});

describe("toWhatsAppId", () => {
  it("converts to WhatsApp id", () => {
    expect(toWhatsAppId("+998901234567")).toBe("998901234567");
  });
});
