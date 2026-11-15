import { describe, expect, it, vi } from "vitest";

import { createApi } from "@/lib/api/client";
import { ApiError, type AppointmentConflict } from "@/lib/api/errors";

import { slotLines } from "./reschedule";
import {
  ADD_RANGE_LABEL,
  CONFLICT_BACK,
  CONFLICT_CONFIRM,
  CONFLICT_LIST_MAX,
  CONFLICT_TITLE,
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
  conflictLines,
  conflictMore,
  conflictText,
  dayProblem,
  nextRange,
  rangeFieldLabel,
  removeRange,
  removeRangeLabel,
  sameWeek,
  saveErrorKind,
  saveErrorText,
  saveWorkingHours,
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

  it("ignores reversed or incomplete ranges and does not collide with an existing valid start", () => {
    expect(nextRange([{ start: "13:00", end: "09:00" }])).toEqual({ start: "", end: "" });
    const afterPartial = nextRange([
      { start: "09:00", end: "13:00" },
      { start: "14:00", end: "" },
    ]);
    expect(afterPartial.start).not.toBe("14:00");
    expect(afterPartial).toEqual({ start: "15:00", end: "16:00" });
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
    expect(CONFLICT_TITLE).toBe("Сохранить новые часы?");
    expect(CONFLICT_CONFIRM).toBe("Да, сохранить");
    expect(CONFLICT_BACK).toBe("Изменить часы");
    expect(CONFLICT_LIST_MAX).toBe(5);
  });
});

const TZ = "Asia/Tashkent";

function setupApi(respond: (input: Request) => Promise<Response>) {
  const fetch = vi.fn<(input: Request) => Promise<Response>>(respond);
  const api = createApi({
    baseUrl: "https://api.test",
    getAccessToken: async () => "tok",
    onUnauthorized: vi.fn(),
    fetch,
  });
  return { fetch, api };
}

describe("saveWorkingHours", () => {
  it("sends PUT /working-hours with blocks and force flag and returns saved week", async () => {
    const blocks = [{ weekday: 1, start: "09:00", end: "13:00" }];
    const { fetch, api } = setupApi(
      async () => new Response(JSON.stringify({ blocks }), { status: 200 }),
    );

    const saved = await saveWorkingHours(api, blocks, false);
    expect(saved).toEqual({ blocks });

    const req = fetch.mock.calls[0]?.[0];
    expect(req?.method).toBe("PUT");
    expect(req?.url).toBe("https://api.test/working-hours");
    expect(await req?.json()).toEqual({ blocks, force: false });

    await saveWorkingHours(api, blocks, true);
    const forcedReq = fetch.mock.calls[1]?.[0];
    expect(await forcedReq?.json()).toEqual({ blocks, force: true });
  });

  it("rejects with ApiError carrying code and conflicts on 409", async () => {
    const conflicts: AppointmentConflict[] = [
      {
        appointmentId: "a1",
        clientName: null,
        start: "2026-11-07T10:00:00+05:00",
        end: "2026-11-07T11:00:00+05:00",
      },
    ];
    const { api } = setupApi(
      async () =>
        new Response(JSON.stringify({ code: "APPOINTMENT_CONFLICT", conflicts }), {
          status: 409,
          headers: { "Content-Type": "application/problem+json" },
        }),
    );

    let caught: unknown;
    try {
      await saveWorkingHours(api, [], false);
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeInstanceOf(ApiError);
    if (caught instanceof ApiError) {
      expect(caught.code).toBe("APPOINTMENT_CONFLICT");
      expect(caught.conflicts).toEqual(conflicts);
    }
  });
});

describe("saveErrorKind and saveErrorText", () => {
  const sampleConflict: AppointmentConflict = {
    appointmentId: "a1",
    clientName: "Айгуль Сапарова",
    start: "2026-11-07T10:00:00+05:00",
    end: "2026-11-07T11:00:00+05:00",
  };

  it("maps error categories", () => {
    expect(
      saveErrorKind(
        new ApiError("problem", { status: 409, code: "APPOINTMENT_CONFLICT", conflicts: [sampleConflict] }),
      ),
    ).toBe("conflict");
    expect(saveErrorKind(new ApiError("problem", { status: 409, code: "APPOINTMENT_CONFLICT" }))).toBe("failed");
    expect(
      saveErrorKind(new ApiError("problem", { status: 409, code: "APPOINTMENT_CONFLICT", conflicts: [] })),
    ).toBe("failed");
    expect(saveErrorKind(new ApiError("problem", { status: 422, code: "INVALID_HOURS" }))).toBe("invalid");
    expect(saveErrorKind(new ApiError("problem", { status: 400, code: "INVALID_REQUEST" }))).toBe("invalid");
    expect(saveErrorKind(new ApiError("network"))).toBe("offline");
    expect(saveErrorKind(new ApiError("server", { status: 500 }))).toBe("failed");
    expect(saveErrorKind(new Error())).toBe("failed");
  });

  it("returns exact Russian error messages", () => {
    expect(saveErrorText("invalid", new Error())).toBe(
      "Эти часы сохранить нельзя. Проверьте, что конец позже начала и часы одного дня не пересекаются.",
    );
    expect(saveErrorText("offline", new ApiError("network"))).toBe(
      "Нет связи с сервером. Часы не сохранены — нажмите «Сохранить», когда интернет вернётся.",
    );
    expect(saveErrorText("failed", new ApiError("server", { status: 500 }))).toBe(
      "Сервер ответил с ошибкой. Код: 500. Часы не сохранены.",
    );
    expect(saveErrorText("failed", new Error())).toBe("Часы не сохранены. Попробуйте ещё раз через минуту.");
  });
});

describe("conflict formatting", () => {
  it("formats conflictText with plural noun and verb agreement", () => {
    const singularTail =
      "Запись останется — её нужно перенести или отменить самим. Новых записей в это время не будет.";
    const pluralTail =
      "Записи останутся — их нужно перенести или отменить самим. Новых записей в это время не будет.";
    expect(conflictText(1)).toBe(`1 запись не попадает в новые часы. ${singularTail}`);
    expect(conflictText(2)).toBe(`2 записи не попадают в новые часы. ${pluralTail}`);
    expect(conflictText(5)).toBe(`5 записей не попадают в новые часы. ${pluralTail}`);
    expect(conflictText(21)).toBe(`21 запись не попадает в новые часы. ${singularTail}`);
  });

  it("sorts conflictLines by start, defaults missing clientName, and formats via slotLines", () => {
    const later: AppointmentConflict = {
      appointmentId: "a2",
      clientName: "Марат Каримов",
      start: "2026-11-08T14:00:00+05:00",
      end: "2026-11-08T15:00:00+05:00",
    };
    const earlier: AppointmentConflict = {
      appointmentId: "a1",
      clientName: null,
      start: "2026-11-07T10:00:00+05:00",
      end: "2026-11-07T11:00:00+05:00",
    };

    const first = slotLines(new Date(earlier.start), new Date(earlier.end), TZ);
    const second = slotLines(new Date(later.start), new Date(later.end), TZ);

    expect(conflictLines([later, earlier], TZ)).toEqual([
      { id: "a1", name: "Клиент без имени", when: `${first.day}, ${first.time}` },
      { id: "a2", name: "Марат Каримов", when: `${second.day}, ${second.time}` },
    ]);
  });

  it("formats conflictMore or returns null for zero", () => {
    expect(conflictMore(0)).toBeNull();
    expect(conflictMore(2)).toBe("И ещё 2 записи.");
    expect(conflictMore(5)).toBe("И ещё 5 записей.");
  });
});
