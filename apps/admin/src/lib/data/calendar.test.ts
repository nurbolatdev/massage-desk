import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";

import {
  blockDetail,
  breaksOf,
  dayNote,
  daySchedule,
  dayShortTitle,
  dayTitle,
  freeSpans,
  freeText,
  gridAppointments,
  gridHours,
  hourRange,
  isDayOff,
  MAX_ROWS,
  loadErrorText,
  minutesOfDay,
  nowMark,
  rowClass,
  rowsOf,
  scheduleView,
  serviceText,
  spanClass,
  spanText,
  weekLabel,
  whenText,
} from "./calendar";
import type { Appointment, TimeOffPeriod } from "./schedule";

const TZ = "Asia/Tashkent";
const DAY = "2026-11-02";

// Tashkent is UTC+5: 10:00 local is 05:00Z.
function at(hhmm: string): Date {
  const [h = 0, m = 0] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2026, 10, 2, h - 5, m));
}

function appointment(over: Partial<Appointment> = {}): Appointment {
  return {
    id: "a1",
    clientId: "c1",
    clientName: "Айгуль",
    clientPhone: "+77010000000",
    serviceId: "s1",
    serviceName: "Спина",
    start: at("10:00"),
    end: at("11:00"),
    status: "confirmed",
    source: "bot",
    ...over,
  };
}

const window = (from: string, to: string) => ({ start: at(from), end: at(to) });

describe("minutesOfDay", () => {
  it("counts from the local midnight and clamps to the day", () => {
    expect(minutesOfDay(at("10:30"), DAY, TZ)).toBe(630);
    expect(minutesOfDay(new Date("2026-11-01T10:00:00Z"), DAY, TZ)).toBe(0);
    expect(minutesOfDay(new Date("2026-11-02T19:00:00Z"), DAY, TZ)).toBe(1440);
  });
  it("stays on the wall clock across daylight saving changes", () => {
    expect(minutesOfDay(new Date("2026-03-29T08:00:00Z"), "2026-03-29", "Europe/Berlin")).toBe(600);
    expect(minutesOfDay(new Date("2026-10-25T09:00:00Z"), "2026-10-25", "Europe/Berlin")).toBe(600);
  });
});

describe("hourRange", () => {
  it("uses the default hours when empty", () => {
    expect(hourRange([])).toEqual({ start: 9, end: 19 });
  });
  it("widens to whole hours", () => {
    expect(hourRange([{ start: 510, end: 570 }, { start: 600, end: 660 }])).toEqual({ start: 8, end: 11 });
    expect(hourRange([{ start: 540, end: 1215 }])).toEqual({ start: 9, end: 21 });
  });
});

describe("rowsOf", () => {
  const range = { start: 9, end: 19 };
  it("maps minutes to 15-minute rows", () => {
    expect(rowsOf(600, 660, range)).toEqual({ start: 5, span: 4 });
    expect(rowsOf(880, 930, range)).toEqual({ start: 23, span: 4 });
  });
  it("clips to the range", () => {
    expect(rowsOf(0, 1440, range)).toEqual({ start: 1, span: 40 });
    expect(rowsOf(1100, 1300, range)).toEqual({ start: 38, span: 3 });
  });
  it("returns null outside the range", () => {
    expect(rowsOf(1200, 1300, range)).toBeNull();
    expect(rowsOf(0, 540, range)).toBeNull();
  });
});

describe("rowClass", () => {
  it("builds the class names", () => {
    expect(rowClass({ start: 5, span: 4 })).toBe("row-start-5 row-span-4");
  });
  it("rejects rows outside the safelist", () => {
    expect(() => rowClass({ start: 0, span: 1 })).toThrow(RangeError);
    expect(() => rowClass({ start: 1, span: 97 })).toThrow(RangeError);
  });
});

describe("breaksOf", () => {
  it("returns the gap between two windows", () => {
    expect(breaksOf([window("09:00", "13:00"), window("14:00", "19:00")])).toEqual([window("13:00", "14:00")]);
  });
  it("returns nothing for one window", () => {
    expect(breaksOf([window("09:00", "19:00")])).toEqual([]);
  });
});

describe("isDayOff", () => {
  const windows = [window("09:00", "13:00"), window("14:00", "19:00")];
  const off = (from: string, to: string): TimeOffPeriod => ({ id: "t", start: at(from), end: at(to) });
  it("is off when known hours have no window", () => {
    expect(isDayOff(DAY, [], [], TZ)).toBe(true);
  });
  it("is off when time off covers the day", () => {
    expect(isDayOff(DAY, windows, [off("00:00", "23:59")], TZ)).toBe(true);
  });
  it("is not off for a partial time off", () => {
    expect(isDayOff(DAY, windows, [off("15:00", "16:00")], TZ)).toBe(false);
  });
  it("treats unknown hours with full time off as off", () => {
    const whole: TimeOffPeriod = { id: "t", start: at("00:00"), end: new Date(at("00:00").getTime() + 86400000) };
    expect(isDayOff(DAY, undefined, [whole], TZ)).toBe(true);
    expect(isDayOff(DAY, undefined, [], TZ)).toBe(false);
  });
});

describe("gridAppointments", () => {
  it("hides a cancelled appointment that overlaps an active one", () => {
    const active = appointment({ id: "active" });
    const hidden = appointment({ id: "hidden", status: "cancelled", start: at("10:30"), end: at("11:30") });
    const apart = appointment({ id: "apart", status: "cancelled", start: at("12:00"), end: at("13:00") });
    expect(gridAppointments([apart, hidden, active]).map((a) => a.id)).toEqual(["active", "apart"]);
  });
});

describe("dayNote", () => {
  it("describes the day", () => {
    expect(dayNote(0, true)).toBe("выходной");
    expect(dayNote(0, false)).toBe("свободно");
    expect(dayNote(1, false)).toBe("1 запись");
    expect(dayNote(3, false)).toBe("3 записи");
    expect(dayNote(5, false)).toBe("5 записей");
  });
});

describe("weekLabel", () => {
  it("handles one month and two months", () => {
    expect(weekLabel(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"])).toBe("2 – 8 ноября");
    expect(weekLabel(["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-06"])).toBe("30 ноября – 6 декабря");
  });
});

describe("appointment texts", () => {
  it("formats when and service", () => {
    expect(whenText(appointment(), TZ)).toBe("Пн 2 нояб., 10:00–11:00");
    expect(serviceText(appointment())).toBe("Спина · 60 мин");
  });
});

describe("scheduleView", () => {
  it("picks the body", () => {
    expect(scheduleView({ hasData: true, error: new Error("x") })).toBe("ready");
    expect(scheduleView({ hasData: false, error: new Error("x") })).toBe("error");
    expect(scheduleView({ hasData: false, error: null })).toBe("loading");
  });
});

describe("loadErrorText", () => {
  it("explains the error", () => {
    expect(loadErrorText(new ApiError("network"))).toBe("Нет связи с сервером. Проверьте интернет и нажмите «Повторить».");
    expect(loadErrorText(new ApiError("server", { status: 503 }))).toBe("Сервер ответил с ошибкой. Код: 503.");
    expect(loadErrorText(new Error())).toBe("Попробуйте ещё раз через минуту.");
  });
});

describe("grid class safelist", () => {
  it("covers the same range as rowClass", () => {
    const css = readFileSync(new URL("../../styles/index.css", import.meta.url), "utf8");
    expect(MAX_ROWS).toBe(96);
    expect(css).toContain(`@source inline("row-start-{1..${MAX_ROWS}} row-span-{1..${MAX_ROWS}}");`);
  });
});

describe("freeSpans", () => {
  const windows = [window("09:00", "13:00"), window("14:00", "19:00")];
  const off = (from: string, to: string): TimeOffPeriod => ({ id: `t-${from}`, start: at(from), end: at(to) });
  const span = (from: string, to: string, status: Appointment["status"] = "confirmed") =>
    appointment({ id: `${from}-${to}`, start: at(from), end: at(to), status });
  const pairs = (list: ReturnType<typeof freeSpans>) => list.map((w) => spanText(w, TZ));

  it("handles empty windows, empty appointments, and edges of a window", () => {
    expect(freeSpans([], [], [], at("08:00"))).toEqual([]);
    expect(pairs(freeSpans(windows, [], [], at("08:00")))).toEqual(["9:00–13:00", "14:00–19:00"]);
    expect(pairs(freeSpans([window("09:00", "13:00")], [span("09:00", "10:00"), span("12:00", "13:00")], [], at("08:00")))).toEqual([
      "10:00–12:00",
    ]);
  });

  it("ignores back-to-back zero gaps, appointments outside windows, and cancelled ones; keeps done/no_show busy", () => {
    const list = [
      span("07:00", "08:00"),
      span("10:00", "11:00", "done"),
      span("11:00", "12:00", "no_show"),
      span("12:00", "12:30", "cancelled"),
      span("13:15", "13:45"),
      span("20:00", "21:00"),
    ];
    expect(pairs(freeSpans(windows, list, [], at("08:00")))).toEqual(["9:00–10:00", "12:00–13:00", "14:00–19:00"]);
  });

  it("handles an appointment spanning the break, overlapping appointments, and unsorted inputs", () => {
    const list = [
      span("12:30", "14:30"),
      span("15:30", "17:00"),
      span("15:00", "16:00"),
    ];
    expect(pairs(freeSpans([windows[1]!, windows[0]!], list, [], at("08:00")))).toEqual(["9:00–12:30", "14:30–15:00", "17:00–19:00"]);
  });

  it("subtracts partial and full time off", () => {
    expect(pairs(freeSpans(windows, [], [off("10:00", "11:00")], at("08:00")))).toEqual(["9:00–10:00", "11:00–13:00", "14:00–19:00"]);
    expect(freeSpans(windows, [], [off("08:00", "20:00")], at("08:00"))).toEqual([]);
  });

  it("clips by notBefore rounded up to 15 min and enforces the 30-minute threshold", () => {
    expect(pairs(freeSpans([window("09:00", "13:00")], [span("10:15", "11:00")], [], at("09:35")))).toEqual([
      "9:45–10:15",
      "11:00–13:00",
    ]);
    expect(pairs(freeSpans([window("09:00", "13:00")], [span("10:14", "11:00")], [], at("09:35")))).toEqual(["11:00–13:00"]);
    expect(freeSpans(windows, [], [], at("19:00"))).toEqual([]);
  });

  it("matches the mockup day schedule at 9:35", () => {
    const mockup = [
      span("10:00", "11:00"),
      span("11:30", "13:00"),
      span("14:30", "15:00"),
      span("16:00", "17:00"),
      span("17:30", "19:00"),
    ];
    expect(pairs(freeSpans(windows, mockup, [], at("09:35")))).toEqual(["11:00–11:30", "14:00–14:30", "15:00–16:00", "17:00–17:30"]);
  });
});

describe("daySchedule", () => {
  const blocks = [1].flatMap((weekday) => [
    { weekday, start: "09:00", end: "13:00" },
    { weekday, start: "14:00", end: "19:00" },
  ]);

  it("leaves free undefined when working hours are unknown", () => {
    const res = daySchedule({ day: DAY, timeZone: TZ, appointments: [appointment()], timeOff: [], workingBlocks: undefined, now: at("09:35") });
    expect(res.windows).toBeUndefined();
    expect(res.off).toBe(false);
    expect(res.count).toBe(1);
    expect(res.free).toBeUndefined();
  });

  it("marks a day off with empty free spans", () => {
    const res = daySchedule({ day: "2026-11-08", timeZone: TZ, appointments: [], timeOff: [], workingBlocks: blocks, now: at("09:35") });
    expect(res.off).toBe(true);
    expect(res.free).toEqual([]);
  });

  it("excludes cancelled from count and other days from list", () => {
    const otherDay = appointment({ id: "other", start: new Date("2026-11-03T05:00:00Z"), end: new Date("2026-11-03T06:00:00Z") });
    const cancelled = appointment({ id: "canc", status: "cancelled", start: at("13:00"), end: at("13:30") });
    const active = appointment({ id: "act", start: at("10:00"), end: at("11:00") });
    const res = daySchedule({
      day: DAY,
      timeZone: TZ,
      appointments: [otherDay, cancelled, active],
      timeOff: [],
      workingBlocks: blocks,
      now: at("09:35"),
    });
    expect(res.list.map((a) => a.id)).toEqual(["act", "canc"]);
    expect(res.count).toBe(1);
  });

  it("drops cancelled appointments overlapping free spans from list but keeps them outside free or on day off", () => {
    const cancelledFree = appointment({ id: "canc-free", status: "cancelled", start: at("15:00"), end: at("16:00") });
    const cancelledPast = appointment({ id: "canc-past", status: "cancelled", start: at("09:00"), end: at("09:30") });
    const active = appointment({ id: "act", start: at("14:00"), end: at("15:00") });
    const active2 = appointment({ id: "act2", start: at("16:00"), end: at("19:00") });
    const afternoon = [{ weekday: 1, start: "14:00", end: "19:00" }];
    const res = daySchedule({
      day: DAY,
      timeZone: TZ,
      appointments: [cancelledPast, active, cancelledFree, active2],
      timeOff: [],
      workingBlocks: afternoon,
      now: at("09:35"),
    });
    expect(res.free?.map((w) => spanText(w, TZ))).toEqual(["15:00–16:00"]);
    expect(res.list.map((a) => a.id)).toEqual(["canc-past", "act", "act2"]);
    expect(res.count).toBe(2);

    const dayOffRes = daySchedule({
      day: "2026-11-08",
      timeZone: TZ,
      appointments: [
        appointment({
          id: "canc-off",
          status: "cancelled",
          start: new Date("2026-11-08T10:00:00+05:00"),
          end: new Date("2026-11-08T11:00:00+05:00"),
        }),
      ],
      timeOff: [],
      workingBlocks: blocks,
      now: at("09:35"),
    });
    expect(dayOffRes.off).toBe(true);
    expect(dayOffRes.list.map((a) => a.id)).toEqual(["canc-off"]);
    expect(dayOffRes.count).toBe(0);
  });
});

describe("gridHours and spanClass", () => {
  it("computes the hour range from windows and appointments", () => {
    expect(gridHours([DAY], () => undefined, [], TZ)).toEqual({ start: 9, end: 19 });
    expect(gridHours([DAY], () => [window("09:00", "13:00")], [appointment({ start: at("08:30"), end: at("09:30") })], TZ)).toEqual({
      start: 8,
      end: 13,
    });
  });

  it("maps dates to row classes or null outside the range", () => {
    const range = { start: 9, end: 19 };
    expect(spanClass(at("10:00"), at("11:00"), DAY, range, TZ)).toBe("row-start-5 row-span-4");
    expect(spanClass(at("19:30"), at("20:00"), DAY, range, TZ)).toBeNull();
  });
});

describe("nowMark", () => {
  const range = { start: 9, end: 19 };
  it("places the mark on the 15-minute row with alignment and hides it outside range", () => {
    expect(nowMark(9 * 60 + 35, range)).toEqual({ start: 3, align: "center" });
    expect(nowMark(9 * 60 + 30, range)).toEqual({ start: 3, align: "start" });
    expect(nowMark(9 * 60 + 44, range)).toEqual({ start: 3, align: "end" });
    expect(nowMark(8 * 60 + 59, range)).toBeNull();
    expect(nowMark(19 * 60, range)).toBeNull();
  });
});

describe("day view texts", () => {
  it("formats day titles, free spans, and appointment detail", () => {
    expect(dayTitle(DAY)).toBe("Понедельник, 2 ноября");
    expect(dayShortTitle(DAY)).toBe("Пн, 2 ноября");
    expect(dayTitle("2026-11-08")).toBe("Воскресенье, 8 ноября");
    expect(dayShortTitle("2026-11-08")).toBe("Вс, 8 ноября");
    expect(freeText([window("14:00", "14:30"), window("15:00", "16:00")], TZ)).toBe("14:00–14:30, 15:00–16:00");
    expect(freeText([], TZ)).toBe("нет");
    expect(blockDetail(appointment({ serviceName: "Массаж спины", source: "bot" }))).toBe("Массаж спины · 60\u00a0мин · бот");
    expect(blockDetail(appointment({ serviceName: "Массаж спины", source: "manual" }))).toBe("Массаж спины · 60\u00a0мин · вручную");
  });
});
