import { describe, expect, it } from "vitest";

import {
  ADD_RANGE_LABEL,
  DAY_OFF_LABEL,
  DAY_PROBLEM_TEXT,
  DEFAULT_RANGE,
  HOURS_INTRO,
  HOURS_LOAD_FAILED,
  HOURS_TITLE,
  MAX_RANGES_PER_DAY,
  SAVED_TEXT,
  SAVE_LABEL,
  SAVE_OFFLINE_HINT,
  addRange,
  canAddRange,
  canSave,
  dayProblem,
  nextRange,
  rangeFieldLabel,
  removeRange,
  removeRangeLabel,
  sameWeek,
  setDayOff,
  setRange,
  toBlocks,
  toDraft,
  weekProblems,
  type WeekDraft,
} from "./workingHours";

function emptyWeek(): WeekDraft {
  return Array.from({ length: 7 }, () => []);
}

describe("toDraft / toBlocks / sameWeek", () => {
  it("groups blocks by weekday, sorts by start, skips invalid weekdays, and leaves Sunday empty", () => {
    const draft = toDraft([
      { weekday: 1, start: "14:00", end: "19:00" },
      { weekday: 6, start: "10:00", end: "15:00" },
      { weekday: 1, start: "09:00", end: "13:00" },
      { weekday: 0, start: "09:00", end: "18:00" },
      { weekday: 8, start: "09:00", end: "18:00" },
    ]);

    expect(draft).toEqual([
      [
        { start: "09:00", end: "13:00" },
        { start: "14:00", end: "19:00" },
      ],
      [],
      [],
      [],
      [],
      [{ start: "10:00", end: "15:00" }],
      [],
    ]);
  });

  it("normalizes blocks via toBlocks(toDraft(x))", () => {
    const raw = [
      { weekday: 3, start: "14:00", end: "18:00" },
      { weekday: 1, start: "14:00", end: "19:00" },
      { weekday: 1, start: "09:00", end: "13:00" },
    ];
    expect(toBlocks(toDraft(raw))).toEqual([
      { weekday: 1, start: "09:00", end: "13:00" },
      { weekday: 1, start: "14:00", end: "19:00" },
      { weekday: 3, start: "14:00", end: "18:00" },
    ]);
  });

  it("compares draft with blocks ignoring order", () => {
    const blocks = [
      { weekday: 2, start: "09:00", end: "18:00" },
      { weekday: 1, start: "14:00", end: "19:00" },
      { weekday: 1, start: "09:00", end: "13:00" },
    ];
    const draft = toDraft(blocks);
    expect(sameWeek(draft, blocks)).toBe(true);
    expect(
      sameWeek(draft, [
        { weekday: 1, start: "09:00", end: "13:00" },
        { weekday: 1, start: "14:00", end: "18:00" },
        { weekday: 2, start: "09:00", end: "18:00" },
      ]),
    ).toBe(false);
    expect(
      sameWeek(draft, [
        ...blocks,
        { weekday: 5, start: "09:00", end: "18:00" },
      ]),
    ).toBe(false);
  });
});

describe("dayProblem / weekProblems / canSave", () => {
  it("accepts empty day, unordered non-touching ranges, and 1-minute gap", () => {
    expect(dayProblem([])).toBeNull();
    expect(
      dayProblem([
        { start: "14:00", end: "19:00" },
        { start: "09:00", end: "13:00" },
      ]),
    ).toBeNull();
    expect(
      dayProblem([
        { start: "09:00", end: "13:00" },
        { start: "13:01", end: "15:00" },
      ]),
    ).toBeNull();
  });

  it("reports empty for blank or non-API time strings", () => {
    expect(dayProblem([{ start: "", end: "13:00" }])).toBe("empty");
    expect(dayProblem([{ start: "9:00", end: "13:00" }])).toBe("empty");
    expect(dayProblem([{ start: "09:00", end: "24:00" }])).toBe("empty");
  });

  it("reports order when end is not strictly after start", () => {
    expect(dayProblem([{ start: "13:00", end: "09:00" }])).toBe("order");
    expect(dayProblem([{ start: "13:00", end: "13:00" }])).toBe("order");
  });

  it("reports overlap when ranges overlap or touch", () => {
    expect(
      dayProblem([
        { start: "09:00", end: "13:00" },
        { start: "12:00", end: "15:00" },
      ]),
    ).toBe("overlap");
    expect(
      dayProblem([
        { start: "09:00", end: "13:00" },
        { start: "13:00", end: "15:00" },
      ]),
    ).toBe("overlap");
  });

  it("computes weekProblems and blocks saving when any day has a problem", () => {
    const draft = emptyWeek();
    draft[0] = [{ start: "09:00", end: "18:00" }];
    draft[2] = [{ start: "13:00", end: "13:00" }];
    expect(weekProblems(draft)).toEqual([null, null, "order", null, null, null, null]);
    expect(canSave(draft)).toBe(false);
    expect(canSave(emptyWeek())).toBe(true);
  });
});

describe("draft operations", () => {
  it("does not mutate the source draft", () => {
    const draft = emptyWeek();
    draft[0] = [{ start: "09:00", end: "13:00" }];
    const snapshot = structuredClone(draft);

    const edited = setRange(draft, 0, 0, { end: "12:00" });
    const added = addRange(draft, 0);
    const removed = removeRange(draft, 0, 0);
    const dayOn = setDayOff(draft, 1, false);
    const dayOff = setDayOff(draft, 0, true);

    expect(draft).toEqual(snapshot);
    expect(edited[0]).toEqual([{ start: "09:00", end: "12:00" }]);
    expect(added[0]).toEqual([
      { start: "09:00", end: "13:00" },
      { start: "14:00", end: "15:00" },
    ]);
    expect(removed[0]).toEqual([]);
    expect(dayOn[1]).toEqual([DEFAULT_RANGE]);
    expect(dayOff[0]).toEqual([]);
  });

  it("ignores addRange when already at MAX_RANGES_PER_DAY", () => {
    const draft = emptyWeek();
    draft[0] = Array.from({ length: MAX_RANGES_PER_DAY }, (_, i) => ({
      start: `${String(9 + i * 2).padStart(2, "0")}:00`,
      end: `${String(10 + i * 2).padStart(2, "0")}:00`,
    }));
    expect(canAddRange(draft[0])).toBe(false);
    expect(addRange(draft, 0)).toEqual(draft);
  });
});

describe("nextRange", () => {
  it("suggests default, +1h gap, or empty fields when out of day or invalid", () => {
    expect(nextRange([])).toEqual({ start: "09:00", end: "18:00" });
    expect(nextRange([{ start: "09:00", end: "13:00" }])).toEqual({ start: "14:00", end: "15:00" });
    expect(
      nextRange([
        { start: "09:00", end: "13:00" },
        { start: "14:00", end: "19:00" },
      ]),
    ).toEqual({ start: "20:00", end: "21:00" });
    expect(nextRange([{ start: "09:00", end: "23:00" }])).toEqual({ start: "", end: "" });
    expect(nextRange([{ start: "", end: "" }])).toEqual({ start: "", end: "" });
  });
});

describe("labels and copy", () => {
  it("builds accessible field and remove labels in Russian", () => {
    expect(rangeFieldLabel(0, 0, "start")).toBe("Понедельник, время 1: начало");
    expect(rangeFieldLabel(0, 0, "end")).toBe("Понедельник, время 1: конец");
    expect(removeRangeLabel(6, 1)).toBe("Удалить: Воскресенье, время 2");
  });

  it("exposes exact UI copy", () => {
    expect(HOURS_TITLE).toBe("Часы работы");
    expect(HOURS_INTRO).toBe(
      "Бот предлагает клиентам только это время. Чтобы сделать перерыв, нажмите «Добавить время» и разделите день на две части.",
    );
    expect(DAY_OFF_LABEL).toBe("Выходной");
    expect(ADD_RANGE_LABEL).toBe("Добавить время");
    expect(SAVE_LABEL).toBe("Сохранить");
    expect(SAVED_TEXT).toBe("Часы сохранены. Бот уже предлагает клиентам новое время.");
    expect(SAVE_OFFLINE_HINT).toBe("Сохранить можно, когда появится связь с сервером.");
    expect(HOURS_LOAD_FAILED).toBe("Не удалось загрузить часы работы");
    expect(DAY_PROBLEM_TEXT.empty).toBe("Укажите начало и конец.");
    expect(DAY_PROBLEM_TEXT.order).toBe("Конец должен быть позже начала.");
    expect(DAY_PROBLEM_TEXT.overlap).toBe(
      "Часы этого дня пересекаются или идут подряд. Объедините их или оставьте перерыв.",
    );
  });
});
