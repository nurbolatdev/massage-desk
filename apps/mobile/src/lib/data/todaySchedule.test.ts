import { describe, expect, it } from "@jest/globals";

import type { Appointment } from "@/types";

import type { WorkingWindow } from "./workingHours";
import { selectNextClient, todaySchedule, tomorrowSummary } from "./todaySchedule";

function appt(start: string, status: Appointment["status"] = "confirmed", end?: string): Appointment {
  return {
    id: start,
    clientId: "c1",
    clientName: "Клиент",
    clientPhone: "+998900000000",
    serviceId: "s1",
    serviceName: "Массаж",
    start: new Date(start),
    end: new Date(end ?? start),
    status,
    source: "bot",
  };
}

describe("tomorrowSummary", () => {
  it("is null for an empty list or only cancelled", () => {
    expect(tomorrowSummary([])).toBeNull();
    expect(tomorrowSummary([appt("2026-11-03T04:00:00Z", "cancelled")])).toBeNull();
  });

  it("counts confirmed only and finds the earliest start in unsorted input", () => {
    const result = tomorrowSummary([
      appt("2026-11-03T08:00:00Z"),
      appt("2026-11-03T03:00:00Z", "cancelled"),
      appt("2026-11-03T05:00:00Z"),
    ]);
    expect(result).toEqual({ count: 2, first: new Date("2026-11-03T05:00:00Z") });
  });
});

const NOW = new Date("2026-11-03T05:00:00Z");
const WHOLE_DAY: WorkingWindow[] = [
  { start: new Date("2026-11-03T00:00:00Z"), end: new Date("2026-11-04T00:00:00Z") },
];

describe("selectNextClient", () => {
  it("chooses an upcoming confirmed appointment", () => {
    const a = appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z");
    expect(selectNextClient([a], NOW)).toBe(a);
  });

  it("chooses an in-progress appointment over a later one", () => {
    const current = appt("2026-11-03T04:30:00Z", "confirmed", "2026-11-03T05:30:00Z");
    const later = appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z");
    expect(selectNextClient([later, current], NOW)).toBe(current);
  });

  it("skips an appointment that ends exactly now", () => {
    expect(selectNextClient([appt("2026-11-03T04:00:00Z", "confirmed", "2026-11-03T05:00:00Z")], NOW)).toBeNull();
  });

  it("skips done, cancelled and no_show even when upcoming", () => {
    const list = (["done", "cancelled", "no_show"] as const).map((status) =>
      appt("2026-11-03T06:00:00Z", status, "2026-11-03T07:00:00Z"),
    );
    expect(selectNextClient(list, NOW)).toBeNull();
  });

  it("gives the earliest for unsorted input", () => {
    const early = appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z");
    const late = appt("2026-11-03T09:00:00Z", "confirmed", "2026-11-03T10:00:00Z");
    const mid = appt("2026-11-03T08:00:00Z", "confirmed", "2026-11-03T08:30:00Z");
    expect(selectNextClient([late, early, mid], NOW)).toBe(early);
  });

  it("is null when nothing is left", () => {
    expect(selectNextClient([], NOW)).toBeNull();
  });
});

describe("todaySchedule", () => {
  it("is empty for [] and for only cancelled", () => {
    expect(todaySchedule([], NOW, WHOLE_DAY).kind).toBe("empty");
    expect(todaySchedule([appt("2026-11-03T06:00:00Z", "cancelled", "2026-11-03T07:00:00Z")], NOW, WHOLE_DAY).kind).toBe("empty");
  });

  it("is finished when every active appointment has ended", () => {
    const past = appt("2026-11-03T02:00:00Z", "confirmed", "2026-11-03T03:00:00Z");
    expect(todaySchedule([past], NOW, WHOLE_DAY).kind).toBe("finished");
  });

  it("is schedule when something is still ahead", () => {
    const next = appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z");
    expect(todaySchedule([next], NOW, WHOLE_DAY).kind).toBe("schedule");
  });

  it("laterCount excludes next and non-confirmed appointments", () => {
    const result = todaySchedule(
      [
        appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z"),
        appt("2026-11-03T07:00:00Z", "confirmed", "2026-11-03T08:00:00Z"),
        appt("2026-11-03T08:00:00Z", "cancelled", "2026-11-03T09:00:00Z"),
        appt("2026-11-03T09:00:00Z", "done", "2026-11-03T10:00:00Z"),
      ],
      NOW,
      WHOLE_DAY,
    );
    expect(result.laterCount).toBe(1);
  });

  it("adds a free row for a 90-minute gap before the later appointment", () => {
    const a = appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z");
    const b = appt("2026-11-03T08:30:00Z", "confirmed", "2026-11-03T09:30:00Z");
    const { rows } = todaySchedule([a, b], NOW, WHOLE_DAY);
    expect(rows).toEqual([
      { kind: "free", start: a.end, end: b.start },
      { kind: "appointment", appointment: b },
    ]);
  });

  it("adds no free row for 29 minutes and one for exactly 30", () => {
    const a = appt("2026-11-03T06:00:00Z", "confirmed", "2026-11-03T07:00:00Z");
    const short = appt("2026-11-03T07:29:00Z", "confirmed", "2026-11-03T08:00:00Z");
    const exact = appt("2026-11-03T07:30:00Z", "confirmed", "2026-11-03T08:00:00Z");
    expect(todaySchedule([a, short], NOW, WHOLE_DAY).rows.map((r) => r.kind)).toEqual(["appointment"]);
    expect(todaySchedule([a, exact], NOW, WHOLE_DAY).rows.map((r) => r.kind)).toEqual(["free", "appointment"]);
  });

  it("adds no free row before next", () => {
    const a = appt("2026-11-03T09:00:00Z", "confirmed", "2026-11-03T10:00:00Z");
    const { rows, next } = todaySchedule([a], NOW, WHOLE_DAY);
    expect(next).toBe(a);
    expect(rows).toEqual([]);
  });

  describe("working windows", () => {
    const windows: WorkingWindow[] = [
      { start: new Date("2026-11-04T04:00:00Z"), end: new Date("2026-11-04T08:00:00Z") },
      { start: new Date("2026-11-04T09:00:00Z"), end: new Date("2026-11-04T14:00:00Z") },
    ];
    const now = new Date("2026-11-04T04:30:00Z");
    const first = appt("2026-11-04T04:30:00Z", "confirmed", "2026-11-04T05:00:00Z");
    const d = (t: string) => new Date(`2026-11-04T${t}:00Z`);
    const rowsFor = (prevEnd: string, nextStart: string, nextEnd: string) => {
      const prev = appt("2026-11-04T05:00:00Z", "confirmed", `2026-11-04T${prevEnd}:00Z`);
      const next = appt(`2026-11-04T${nextStart}:00Z`, "confirmed", `2026-11-04T${nextEnd}:00Z`);
      return { next, rows: todaySchedule([first, prev, next], now, windows).rows };
    };

    it("shows a break, not free time, between two blocks", () => {
      const { rows, next } = rowsFor("08:00", "09:00", "10:00");
      expect(rows[1]).toEqual({ kind: "break", start: d("08:00"), end: d("09:00") });
      expect(rows.map((r) => r.kind)).toEqual(["appointment", "break", "appointment"]);
      expect(rows[2]).toEqual({ kind: "appointment", appointment: next });
    });

    it("ends free time at the break start", () => {
      const { rows } = rowsFor("07:00", "09:00", "10:00");
      expect(rows.slice(1, 3)).toEqual([
        { kind: "free", start: d("07:00"), end: d("08:00") },
        { kind: "break", start: d("08:00"), end: d("09:00") },
      ]);
    });

    it("splits a gap into free, break and free", () => {
      const { rows } = rowsFor("06:30", "10:00", "11:00");
      expect(rows.slice(1, 4)).toEqual([
        { kind: "free", start: d("06:30"), end: d("08:00") },
        { kind: "break", start: d("08:00"), end: d("09:00") },
        { kind: "free", start: d("09:00"), end: d("10:00") },
      ]);
    });

    it("drops free time shorter than 30 minutes before a break", () => {
      const { rows } = rowsFor("07:40", "09:00", "10:00");
      expect(rows.map((r) => r.kind)).toEqual(["appointment", "break", "appointment"]);
    });

    it("cuts the break at an appointment booked inside it", () => {
      const { rows } = rowsFor("07:00", "08:30", "09:00");
      expect(rows[2]).toEqual({ kind: "break", start: d("08:00"), end: d("08:30") });
    });

    it("gives nothing for the part after the last window", () => {
      const { rows } = rowsFor("13:00", "14:30", "15:00");
      expect(rows.slice(1)).toEqual([
        { kind: "free", start: d("13:00"), end: d("14:00") },
        expect.objectContaining({ kind: "appointment" }),
      ]);
    });

    it("gives only appointment rows for empty or unknown windows", () => {
      const prev = appt("2026-11-04T05:00:00Z", "confirmed", "2026-11-04T07:00:00Z");
      const next = appt("2026-11-04T09:00:00Z", "confirmed", "2026-11-04T10:00:00Z");
      for (const w of [[], undefined]) {
        const result = todaySchedule([first, prev, next], now, w);
        expect(result.rows.map((r) => r.kind)).toEqual(["appointment", "appointment"]);
        expect(result.laterCount).toBe(2);
      }
    });
  });
});
