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

describe("whole-part matching", () => {
  it("does not select a phrase that is only a fragment of a part", () => {
    expect(hasPhrase("Не болит шея уже", "Болит шея")).toBe(false);
    expect(toggleNotePhrase("Не болит шея уже", "Болит шея")).toBe("Не болит шея уже. Болит шея");
  });

  it("does not corrupt text that contains the phrase as a prefix of a word", () => {
    expect(toggleNotePhrase("Болит шеяи плечо", "Болит шея")).toBe("Болит шеяи плечо. Болит шея");
  });

  it("selects a part that equals the phrase, ignoring case and spaces", () => {
    expect(hasPhrase("Любит тишину,  болит ШЕЯ.", "Болит шея")).toBe(true);
  });

  it("removes the last phrase without a dangling separator", () => {
    expect(toggleNotePhrase("Любит тишину, Болит шея.", "Болит шея")).toBe("Любит тишину");
  });

  it("removes a phrase in the middle", () => {
    expect(toggleNotePhrase("А. Болит шея. Б", "Болит шея")).toBe("А. Б");
  });

  it("returns an empty text when the phrase is the only content", () => {
    expect(toggleNotePhrase("Болит шея", "Болит шея")).toBe("");
  });
});

describe("separators and line breaks", () => {
  it("treats a separator followed by a line break as one separator", () => {
    expect(toggleNotePhrase("Любит тишину.\nБолит шея.\nБ.", "Болит шея")).toBe(
      "Любит тишину.\nБ.",
    );
  });

  it("removes a phrase after a semicolon", () => {
    expect(toggleNotePhrase("А; Болит шея", "Болит шея")).toBe("А");
  });

  it("removes a phrase between plain line breaks", () => {
    expect(toggleNotePhrase("Любит тишину\nБолит шея\nБ", "Болит шея")).toBe("Любит тишину\nБ");
  });

  it("adds after a trailing comma or semicolon with a period", () => {
    expect(toggleNotePhrase("Любит тишину,", "Болит шея")).toBe("Любит тишину. Болит шея");
    expect(toggleNotePhrase("Любит тишину;", "Болит шея")).toBe("Любит тишину. Болит шея");
  });

  it("recognises a phrase ending with ! or ? and does not duplicate it", () => {
    expect(hasPhrase("Болит шея!", "Болит шея")).toBe(true);
    expect(hasPhrase("Болит шея?", "Болит шея")).toBe(true);
    expect(toggleNotePhrase("Болит шея!", "Болит шея")).toBe("");
  });

  it("removes every occurrence of a repeated phrase in one tap", () => {
    expect(toggleNotePhrase("Болит шея. Болит шея", "Болит шея")).toBe("");
    expect(toggleNotePhrase("А. Болит шея. Б. Болит шея", "Болит шея")).toBe("А. Б.");
  });
});

describe("noteSheetSubtitle", () => {
  it("adds the privacy hint", () => {
    expect(noteSheetSubtitle("Айгуль Сапарова")).toBe("Айгуль Сапарова · видите только вы");
  });
});
