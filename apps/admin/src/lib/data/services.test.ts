import { describe, expect, it } from "vitest";

import { NBSP } from "@/lib/format";

import { formatAmount, formatDuration, formatPrice, offeredText } from "./services";

describe("formatAmount", () => {
  it.each([
    [8000, "8 000"],
    [1500.5, "1 500,5"],
  ])("formats %d without the currency", (price, text) => {
    expect(formatAmount(price)).toBe(text.replaceAll(" ", NBSP));
  });
});

describe("formatDuration", () => {
  it.each([5, 60, 480])("formats %i minutes", (min) => {
    expect(formatDuration(min)).toBe(`${min}${NBSP}мин`);
  });
});

describe("formatPrice", () => {
  it.each([
    [8000, "8 000"],
    [12000, "12 000"],
    [500, "500"],
    [0, "0"],
    [1500.5, "1 500,5"],
    [1234567, "1 234 567"],
  ])("formats %d", (price, text) => {
    expect(formatPrice(price)).toBe(`${text.replaceAll(" ", NBSP)}${NBSP}₸`);
  });
});

describe("offeredText", () => {
  it("says yes for an active service", () => {
    expect(offeredText(true)).toBe("Да");
  });

  it("says hidden for an inactive service", () => {
    expect(offeredText(false)).toBe("Нет, скрыта");
  });
});
