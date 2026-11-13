import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";

import {
  breaksOf,
  dayNote,
  gridAppointments,
  hourRange,
  isDayOff,
  loadErrorText,
  minutesOfDay,
  rowClass,
  rowsOf,
  scheduleView,
  serviceText,
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
    expect(rowsOf(1200, 1300, range)).toEqual({ start: 40, span: 1 });
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
