import { describe, expect, it } from "vitest";

import { NBSP } from "@/lib/format";

import {
  lastVisitText,
  nextVisitText,
  noShowsClass,
  SEGMENT_FILTERS,
  summaryText,
} from "./clientList";

describe("summaryText", () => {
  it("has no text without clients", () => {
    expect(summaryText({ total: 0, newLast30Days: 0 })).toBeNull();
  });

  it("joins the total and the new clients", () => {
    expect(summaryText({ total: 142, newLast30Days: 9 })).toBe(
      `142${NBSP}клиента · 9${NBSP}новых за месяц`,
    );
    expect(summaryText({ total: 21, newLast30Days: 1 })).toBe(
      `21${NBSP}клиент · 1${NBSP}новый за месяц`,
    );
    expect(summaryText({ total: 11, newLast30Days: 2 })).toBe(
      `11${NBSP}клиентов · 2${NBSP}новых за месяц`,
    );
  });

  it("omits the new clients when there are none", () => {
    expect(summaryText({ total: 5, newLast30Days: 0 })).toBe(`5${NBSP}клиентов`);
  });
});

describe("lastVisitText", () => {
  it("shows a dash without a visit", () => {
    expect(lastVisitText(null, 2026)).toBe("—");
  });

  it("omits the year only for the current one", () => {
    expect(lastVisitText("2026-10-12T10:00:00+05:00", 2026)).toBe("12 окт.");
    expect(lastVisitText("2025-10-12T10:00:00+05:00", 2026)).toBe("12 окт. 2025 г.");
  });

  it("takes the day from the master's local time in the string", () => {
    expect(lastVisitText("2026-10-13T01:00:00+05:00", 2026)).toBe("13 окт.");
  });
});

describe("nextVisitText", () => {
  it("shows a dash without a next appointment", () => {
    expect(nextVisitText(null, "2026-11-16")).toBe("—");
  });

  it("shows the time for today", () => {
    expect(nextVisitText("2026-11-16T10:00:00+05:00", "2026-11-16")).toBe("сегодня, 10:00");
    expect(nextVisitText("2026-11-16T09:30:00+05:00", "2026-11-16")).toBe("сегодня, 9:30");
  });

  it("shows the weekday and date for another day or an unknown today", () => {
    expect(nextVisitText("2026-11-02T10:00:00+05:00", "2026-11-16")).toBe("пн, 2 нояб.");
    expect(nextVisitText("2026-11-02T10:00:00+05:00", undefined)).toBe("пн, 2 нояб.");
  });
});

describe("noShowsClass", () => {
  it("highlights only a positive count", () => {
    expect(noShowsClass(0)).toBe("font-bold text-muted");
    expect(noShowsClass(2)).toBe("font-bold text-accent-strong");
  });
});

describe("SEGMENT_FILTERS", () => {
  it("lists the chips in the mockup order", () => {
    expect(SEGMENT_FILTERS.map((f) => f.label)).toEqual([
      "Все",
      "Постоянные",
      "Давно не были",
      "С неявками",
    ]);
  });
});
