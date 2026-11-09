import { describe, expect, it } from "@jest/globals";

import type { Appointment } from "@/types";

import {
  appointmentsOfDay,
  calendarRows,
  dayCellLabel,
  dayCounts,
  daySummary,
  dayTitle,
  monthTitle,
  weekdayShort,
  weekRangeLabel,
} from "./calendar";
import { weekDays } from "./days";

const TZ = "Asia/Tashkent";

function appt(
  id: string,
  start: string,
  end: string,
  status: Appointment["status"] = "confirmed",
): Appointment {
  return {
    id,
    clientId: "c",
    clientName: "Client",
    clientPhone: "+998900000000",
    serviceId: "s",
    serviceName: "Massage",
    start: new Date(start),
    end: new Date(end),
    status,
    source: "bot",
  };
}

describe("dayCounts", () => {
  it("groups by the master's local day", () => {
    const counts = dayCounts([appt("a", "2026-11-02T19:30:00Z", "2026-11-02T20:30:00Z")], TZ);
    expect(counts).toEqual({ "2026-11-03": 1 });
  });

  it("skips cancelled and counts done and no_show", () => {
    const counts = dayCounts(
      [
        appt("a", "2026-11-02T05:00:00Z", "2026-11-02T06:00:00Z", "cancelled"),
        appt("b", "2026-11-02T07:00:00Z", "2026-11-02T08:00:00Z", "done"),
        appt("c", "2026-11-02T09:00:00Z", "2026-11-02T10:00:00Z", "no_show"),
      ],
      TZ,
    );
    expect(counts).toEqual({ "2026-11-02": 2 });
  });
});

describe("appointmentsOfDay", () => {
  it("returns the day's shown appointments by start", () => {
    const list = appointmentsOfDay(
      [
        appt("late", "2026-11-02T09:00:00Z", "2026-11-02T10:00:00Z"),
        appt("early", "2026-11-02T05:00:00Z", "2026-11-02T06:00:00Z"),
        appt("gone", "2026-11-02T07:00:00Z", "2026-11-02T08:00:00Z", "cancelled"),
        appt("other", "2026-11-03T05:00:00Z", "2026-11-03T06:00:00Z"),
      ],
      "2026-11-02",
      TZ,
    );
    expect(list.map((a) => a.id)).toEqual(["early", "late"]);
  });
});

describe("calendarRows", () => {
  const first = appt("a", "2026-11-02T05:00:00Z", "2026-11-02T06:00:00Z");

  it("adds a free row for a 30 minute gap", () => {
    const rows = calendarRows([first, appt("b", "2026-11-02T06:30:00Z", "2026-11-02T07:30:00Z")], true);
    expect(rows.map((r) => r.kind)).toEqual(["appointment", "free", "appointment"]);
  });

  it("adds no free row for a 25 minute gap", () => {
    const rows = calendarRows([first, appt("b", "2026-11-02T06:25:00Z", "2026-11-02T07:25:00Z")], true);
    expect(rows.map((r) => r.kind)).toEqual(["appointment", "appointment"]);
  });

  it("measures the gap from the latest end when appointments overlap", () => {
    const long = appt("a", "2026-11-02T05:00:00Z", "2026-11-02T08:00:00Z");
    const inside = appt("b", "2026-11-02T05:30:00Z", "2026-11-02T06:00:00Z");
    const after = appt("c", "2026-11-02T08:10:00Z", "2026-11-02T09:00:00Z");
    const rows = calendarRows([long, inside, after], true);
    expect(rows.map((r) => r.kind)).toEqual(["appointment", "appointment", "appointment"]);
  });

  it("gives only appointments when free rows are off", () => {
    const rows = calendarRows([first, appt("b", "2026-11-02T09:00:00Z", "2026-11-02T10:00:00Z")], false);
    expect(rows.map((r) => r.kind)).toEqual(["appointment", "appointment"]);
  });
});

describe("calendar texts", () => {
  it("titles the month", () => {
    expect(monthTitle("2026-11-04", "2026-11-04")).toBe("Ноябрь");
    expect(monthTitle("2027-01-05", "2026-11-04")).toBe("Январь 2027");
  });

  it("labels the week range", () => {
    expect(weekRangeLabel(weekDays("2026-11-04"))).toBe("2–8 ноября");
    expect(weekRangeLabel(weekDays("2026-11-30"))).toBe("30 ноября – 6 декабря");
  });

  it("names days", () => {
    expect(dayTitle("2026-11-02")).toBe("Понедельник, 2 ноября");
    expect(weekdayShort("2026-11-02")).toBe("Пн");
  });

  it("summarises a day", () => {
    expect(daySummary(1, false)).toBe("1 запись");
    expect(daySummary(3, false)).toBe("3 записи");
    expect(daySummary(5, false)).toBe("5 записей");
    expect(daySummary(11, false)).toBe("11 записей");
    expect(daySummary(21, false)).toBe("21 запись");
    expect(daySummary(0, false)).toBe("Свободно");
    expect(daySummary(0, true)).toBe("Записей нет");
  });

  it("builds the cell label", () => {
    expect(dayCellLabel("2026-11-02", 2, false)).toBe("Понедельник, 2 ноября, 2 записи");
    expect(dayCellLabel("2026-11-02", 0, false)).toBe("Понедельник, 2 ноября, Свободно");
    expect(dayCellLabel("2026-11-02", 0, true)).toBe("Понедельник, 2 ноября, Записей нет");
  });

  it("builds the cell label without a summary while loading", () => {
    expect(dayCellLabel("2026-11-02", undefined, false)).toBe("Понедельник, 2 ноября");
  });
});
