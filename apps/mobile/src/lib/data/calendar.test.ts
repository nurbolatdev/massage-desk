import { describe, expect, it } from "@jest/globals";

import type { Appointment } from "@/types";

import {
  appointmentsOfDay,
  calendarRows,
  dayCellLabel,
  dayCardLine,
  dayCardTitle,
  dayCounts,
  daysOff,
  daySummary,
  dayTitle,
  monthTitle,
  weekdayShort,
  rangeLabel,
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
    expect(rangeLabel(weekDays("2026-11-04"))).toBe("2–8 ноября");
    expect(rangeLabel(weekDays("2026-11-30"))).toBe("30 ноября – 6 декабря");
  });

  it("labels the month range", () => {
    expect(rangeLabel(["2026-11-01", "2026-11-30"])).toBe("1–30 ноября");
    expect(rangeLabel(["2026-12-01", "2026-12-31"])).toBe("1–31 декабря");
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

describe("dayCardTitle", () => {
  it("builds the title", () => {
    expect(dayCardTitle("2026-11-02", 5, false)).toBe("Пн, 2 ноября · 5 записей");
    expect(dayCardTitle("2026-11-01", 0, true)).toBe("Вс, 1 ноября · Записей нет");
    expect(dayCardTitle("2026-12-04", 0, false)).toBe("Пт, 4 декабря · Свободно");
  });

  it("has no summary while loading", () => {
    expect(dayCardTitle("2026-11-02", undefined, false)).toBe("Пн, 2 ноября");
  });
});

describe("dayCardLine", () => {
  // Asia/Tashkent is UTC+5: 10:00-11:00, 11:00-13:00, 14:30-15:30 local.
  const all = [
    appt("x", "2026-11-02T05:00:00Z", "2026-11-02T06:00:00Z"),
    appt("y", "2026-11-02T06:00:00Z", "2026-11-02T08:00:00Z"),
    appt("z", "2026-11-02T09:30:00Z", "2026-11-02T10:30:00Z"),
  ];

  it("names the first appointment and the first free gap", () => {
    const list = appointmentsOfDay(all, "2026-11-02", TZ);
    expect(dayCardLine(list, true, TZ)).toBe("Первая в 10:00, свободно 13:00–14:30");
  });

  it("omits the free gap when free time is off", () => {
    const list = appointmentsOfDay(all, "2026-11-02", TZ);
    expect(dayCardLine(list, false, TZ)).toBe("Первая в 10:00");
  });

  it("ignores a cancelled first appointment", () => {
    const list = appointmentsOfDay(
      [appt("c", "2026-11-02T03:00:00Z", "2026-11-02T04:00:00Z", "cancelled"), ...all],
      "2026-11-02",
      TZ,
    );
    expect(dayCardLine(list, true, TZ)).toBe("Первая в 10:00, свободно 13:00–14:30");
  });

  it("is null for an empty day", () => {
    expect(dayCardLine([], true, TZ)).toBeNull();
  });
});

describe("days off logic", () => {
  const period = (start: string, end: string) => ({
    id: "t",
    start: new Date(start),
    end: new Date(end),
  });
  const days = weekDays("2026-11-02");

  it("a whole local day closes only that day", () => {
    const off = daysOff([period("2026-11-08T00:00:00+05:00", "2026-11-09T00:00:00+05:00")], days, TZ);
    expect([...off.closed]).toEqual(["2026-11-08"]);
    expect([...off.partial]).toEqual([]);
  });

  it("a three day vacation closes three days", () => {
    const off = daysOff([period("2026-11-03T00:00:00+05:00", "2026-11-06T00:00:00+05:00")], days, TZ);
    expect([...off.closed]).toEqual(["2026-11-03", "2026-11-04", "2026-11-05"]);
  });

  it("some hours make the day partial, not closed", () => {
    const off = daysOff([period("2026-11-05T14:00:00+05:00", "2026-11-05T18:00:00+05:00")], days, TZ);
    expect(off.closed.size).toBe(0);
    expect([...off.partial]).toEqual(["2026-11-05"]);
  });

  it("a period across midnight closes the middle day and touches the edges", () => {
    const off = daysOff([period("2026-11-07T23:00:00+05:00", "2026-11-09T01:00:00+05:00")], [...days, "2026-11-09"], TZ);
    expect([...off.closed]).toEqual(["2026-11-08"]);
    expect([...off.partial].sort()).toEqual(["2026-11-07", "2026-11-09"]);
  });

  it("an end exactly at midnight does not touch the next day", () => {
    const off = daysOff([period("2026-11-08T12:00:00+05:00", "2026-11-09T00:00:00+05:00")], [...days, "2026-11-09"], TZ);
    expect([...off.partial]).toEqual(["2026-11-08"]);
  });

  it("ignores days outside the list", () => {
    const off = daysOff([period("2026-12-01T00:00:00+05:00", "2026-12-02T00:00:00+05:00")], days, TZ);
    expect(off.closed.size).toBe(0);
    expect(off.partial.size).toBe(0);
  });

  it("writes off days in summaries and titles", () => {
    expect(daySummary(0, false, true)).toBe("Выходной");
    expect(daySummary(2, false, true)).toBe("Выходной · 2 записи");
    expect(dayCellLabel("2026-11-08", 0, false, true)).toBe("Воскресенье, 8 ноября, Выходной");
    expect(dayCardTitle("2026-11-08", 0, false, true)).toBe("Вс, 8 ноября · Выходной");
  });
});
