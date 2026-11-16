import { describe, expect, it } from "vitest";

import {
  formatInterval,
  formatSpent,
  type HistoryItem,
  historyDay,
  historyStatus,
  nextHistoryOffset,
  visitsLabel,
} from "./clientVisits";

const NB = " ";

function items(n: number): HistoryItem[] {
  return Array.from({ length: n }, (_, i) => ({ id: String(i) }) as HistoryItem);
}

describe("visitsLabel", () => {
  it("declines", () => {
    expect(visitsLabel(1)).toBe("визит");
    expect(visitsLabel(3)).toBe("визита");
    expect(visitsLabel(5)).toBe("визитов");
    expect(visitsLabel(11)).toBe("визитов");
    expect(visitsLabel(0)).toBe("визитов");
  });
});

describe("formatSpent", () => {
  it("compacts amounts", () => {
    expect(formatSpent(0)).toBe("—");
    expect(formatSpent(950)).toBe("950");
    expect(formatSpent(1500)).toBe(`1,5${NB}тыс.`);
    expect(formatSpent(52000)).toBe(`52${NB}тыс.`);
    expect(formatSpent(118000)).toBe(`118${NB}тыс.`);
    expect(formatSpent(1200000)).toBe(`1,2${NB}млн`);
  });
});

describe("formatInterval", () => {
  it("picks days, weeks or months", () => {
    expect(formatInterval(null)).toBe("—");
    expect(formatInterval(1)).toBe(`1${NB}дн.`);
    expect(formatInterval(3)).toBe(`3${NB}дн.`);
    expect(formatInterval(7)).toBe(`1${NB}нед.`);
    expect(formatInterval(10)).toBe(`1${NB}нед.`);
    expect(formatInterval(14)).toBe(`2${NB}нед.`);
    expect(formatInterval(59)).toBe(`8${NB}нед.`);
    expect(formatInterval(60)).toBe(`2${NB}мес.`);
    expect(formatInterval(90)).toBe(`3${NB}мес.`);
  });
});

describe("historyDay", () => {
  it("shows the year only when it differs", () => {
    expect(historyDay("2026-10-12T10:00:00+05:00", 2026)).toBe("12 окт.");
    expect(historyDay("2026-10-12T10:00:00+05:00", 2027)).toBe("12 окт. 2026 г.");
    expect(historyDay("2026-10-13T01:00:00+05:00", 2026)).toBe("13 окт.");
  });
});

describe("historyStatus", () => {
  const now = new Date("2026-11-16T12:00:00+05:00");
  const at = (status: HistoryItem["status"], start: string, end: string) =>
    historyStatus({ status, start, end }, now);

  it("maps statuses", () => {
    expect(at("done", "2026-11-01T10:00:00+05:00", "2026-11-01T11:00:00+05:00")).toEqual({ text: "Прошла", tone: "done" });
    expect(at("confirmed", "2026-11-01T10:00:00+05:00", "2026-11-01T11:00:00+05:00")).toEqual({ text: "Прошла", tone: "done" });
    expect(at("confirmed", "2026-11-16T11:30:00+05:00", "2026-11-16T12:30:00+05:00")).toEqual({ text: "Идёт", tone: "planned" });
    expect(at("confirmed", "2026-11-20T10:00:00+05:00", "2026-11-20T11:00:00+05:00")).toEqual({ text: "Запланирована", tone: "planned" });
    expect(at("no_show", "2026-11-01T10:00:00+05:00", "2026-11-01T11:00:00+05:00")).toEqual({ text: "Не пришёл", tone: "missed" });
    expect(at("cancelled", "2026-11-01T10:00:00+05:00", "2026-11-01T11:00:00+05:00")).toEqual({ text: "Отменена", tone: "cancelled" });
  });

  it("handles boundaries", () => {
    expect(at("confirmed", "2026-11-16T11:00:00+05:00", "2026-11-16T12:00:00+05:00").text).toBe("Прошла");
    expect(at("confirmed", "2026-11-16T12:00:00+05:00", "2026-11-16T13:00:00+05:00").text).toBe("Идёт");
  });
});

describe("nextHistoryOffset", () => {
  it("continues only after a full page", () => {
    expect(nextHistoryOffset(items(3), [items(3)])).toBeUndefined();
    expect(nextHistoryOffset(items(10), [items(10)])).toBe(10);
    expect(nextHistoryOffset(items(10), [items(10), items(10)])).toBe(20);
    expect(nextHistoryOffset(items(0), [items(10), items(0)])).toBeUndefined();
  });
});
