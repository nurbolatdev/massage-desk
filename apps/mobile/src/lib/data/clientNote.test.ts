import { describe, expect, it } from "@jest/globals";

import { hasPhrase, noteSheetSubtitle, toggleNotePhrase } from "./clientNote";

describe("hasPhrase", () => {
  it("matches case-insensitively inside a sentence", () => {
    expect(
      hasPhrase("Болит поясница. Среднее давление, без масла с запахом.", "Без масла с запахом"),
    ).toBe(true);
  });

  it("is false when the phrase is absent", () => {
    expect(hasPhrase("Болит шея", "Слабое давление")).toBe(false);
  });
});

describe("toggleNotePhrase", () => {
  it("adds a phrase to an empty text without a separator", () => {
    expect(toggleNotePhrase("", "Болит шея")).toBe("Болит шея");
  });

  it("joins with a period when the text has no end mark", () => {
    expect(toggleNotePhrase("Болит шея", "Слабое давление")).toBe("Болит шея. Слабое давление");
  });

  it("joins with a space when the text ends with a period", () => {
    expect(toggleNotePhrase("Болит шея.", "Слабое давление")).toBe("Болит шея. Слабое давление");
  });

  it("removes the first phrase with its separator", () => {
    expect(toggleNotePhrase("Болит шея. Слабое давление", "Болит шея")).toBe("Слабое давление");
  });

  it("removes the last phrase and keeps the previous period", () => {
    expect(toggleNotePhrase("Болит шея. Слабое давление", "Слабое давление")).toBe("Болит шея.");
  });
});

describe("noteSheetSubtitle", () => {
  it("adds the privacy hint", () => {
    expect(noteSheetSubtitle("Айгуль Сапарова")).toBe("Айгуль Сапарова · видите только вы");
  });
});
