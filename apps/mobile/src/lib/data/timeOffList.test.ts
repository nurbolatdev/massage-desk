import { describe, expect, it } from "@jest/globals";

import { addDays, dayDate } from "./days";
import type { TimeOffPeriod } from "./timeOff";
import { periodView, timeOffSummary, upcomingPeriods, upcomingWindows } from "./timeOffList";
import type { PeriodView } from "./timeOffList";

const ALMATY = "Asia/Almaty";
const period = (id: string, start: string, end: string): TimeOffPeriod => ({
  id,
  start: new Date(start),
  end: new Date(end),
});
const days = (from: string, to: string) =>
  Math.round((dayDate(to).getTime() - dayDate(from).getTime()) / 86_400_000) + 1;

describe("upcomingWindows", () => {
  it("covers two years in two windows of at most 366 days", () => {
    const [a, b] = upcomingWindows("2026-11-04");
    expect(a).toEqual({ from: "2026-11-04", to: "2027-11-04" });
    expect(b).toEqual({ from: "2027-11-05", to: "2028-11-04" });
    expect(days(a.from, a.to)).toBeLessThanOrEqual(366);
    expect(days(b.from, b.to)).toBeLessThanOrEqual(366);
    expect(addDays(a.to, 1)).toBe(b.from);
  });
});

describe("upcomingPeriods", () => {
  const now = new Date("2026-11-04T05:00:00.000Z");
  const a = period("a", "2026-12-14T19:00:00.000Z", "2026-12-22T19:00:00.000Z");
  const b = period("b", "2026-11-30T19:00:00.000Z", "2026-12-01T19:00:00.000Z");

  it("is undefined while one list is missing", () => {
    expect(upcomingPeriods([[a], undefined], now)).toBeUndefined();
  });

  it("shows a period returned by both windows once, ordered by start", () => {
    expect(upcomingPeriods([[a, b], [a]], now)?.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("drops ended periods and keeps ongoing ones", () => {
    const ended = period("e", "2026-11-03T19:00:00.000Z", "2026-11-04T04:00:00.000Z");
    const ongoing = period("o", "2026-11-02T19:00:00.000Z", "2026-11-06T19:00:00.000Z");
    expect(upcomingPeriods([[ended, ongoing], []], now)?.map((p) => p.id)).toEqual(["o"]);
  });
});

describe("periodView", () => {
  it("names one whole day", () => {
    const view = periodView(period("t", "2026-12-14T19:00:00.000Z", "2026-12-15T19:00:00.000Z"), ALMATY);
    expect(view).toEqual({ id: "t", title: "15 декабря", kind: "Выходной", word: "Выходной" });
  });

  it("names a vacation", () => {
    const view = periodView(period("t", "2026-12-14T19:00:00.000Z", "2026-12-22T19:00:00.000Z"), ALMATY);
    expect(view).toMatchObject({ title: "15 – 22 декабря", kind: "Отпуск · 8 дней", word: "Отпуск" });
  });

  it("names a vacation across years", () => {
    const view = periodView(period("t", "2026-12-29T19:00:00.000Z", "2027-01-05T19:00:00.000Z"), ALMATY);
    expect(view.title).toBe("30 декабря – 5 января");
  });

  it("names part of a day", () => {
    const view = periodView(period("t", "2026-12-15T08:00:00.000Z", "2026-12-15T12:00:00.000Z"), ALMATY);
    expect(view).toMatchObject({ title: "15 декабря", kind: "Отгул · 13:00 – 17:00", word: "Отгул" });
  });

  it("keeps a whole-day period whole across a DST change", () => {
    const view = periodView(period("t", "2026-03-27T23:00:00.000Z", "2026-03-29T22:00:00.000Z"), "Europe/Berlin");
    expect(view).toMatchObject({ title: "28 – 29 марта", kind: "Отпуск · 2 дня", word: "Отпуск" });
  });
});

describe("timeOffSummary", () => {
  const view = (id: string, title: string, word: PeriodView["word"]): PeriodView => ({
    id,
    title,
    kind: "",
    word,
  });

  it("is unknown while the data is unknown", () => {
    expect(timeOffSummary(undefined)).toBeUndefined();
  });

  it("says nothing is set", () => {
    expect(timeOffSummary([])).toBe("Отпуск не задан");
  });

  it("names the nearest period and counts the rest", () => {
    expect(timeOffSummary([view("a", "15 – 22 декабря", "Отпуск")])).toBe("Отпуск · 15 – 22 декабря");
    expect(
      timeOffSummary([
        view("a", "31 декабря", "Выходной"),
        view("b", "5 января", "Выходной"),
        view("c", "9 января", "Выходной"),
      ]),
    ).toBe("Выходной · 31 декабря и ещё 2");
  });
});
