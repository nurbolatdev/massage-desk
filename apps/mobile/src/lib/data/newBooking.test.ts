import { describe, expect, it } from "@jest/globals";

import { NBSP } from "../format";
import {
  bookLabel,
  chipColumns,
  chunk,
  conflictTitle,
  dayChoices,
  serviceMeta,
  submitState,
  takenA11y,
  timeChoices,
  whenText,
  type SubmitInput,
} from "./newBooking";

const TZ = "Asia/Tashkent";
const START = "2026-11-03T15:00:00+05:00";

describe("dayChoices", () => {
  it("names today and tomorrow, then weekday and number", () => {
    const days = dayChoices("2026-11-02", 4);
    expect(days.map((d) => d.label)).toEqual(["Сегодня", "Завтра", "Ср 4", "Чт 5"]);
    expect(days.map((d) => d.day)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"]);
  });

  it("crosses the month", () => {
    expect(dayChoices("2026-11-30", 3).map((d) => d.day)).toEqual(["2026-11-30", "2026-12-01", "2026-12-02"]);
  });
});

describe("whenText", () => {
  const start = new Date("2026-11-03T10:00:00Z");

  it("says tomorrow", () => {
    expect(whenText(start, "2026-11-02", TZ)).toBe("завтра, 15:00");
  });

  it("says today", () => {
    expect(whenText(start, "2026-11-03", TZ)).toBe("сегодня, 15:00");
  });

  it("spells out a later day", () => {
    expect(whenText(start, "2026-11-01", TZ)).toBe("вт, 3 нояб., 15:00");
  });
});

describe("labels", () => {
  it("builds the texts", () => {
    expect(bookLabel("завтра, 15:00")).toBe("Записать · завтра, 15:00");
    expect(conflictTitle("15:00")).toBe("15:00 уже занято");
    expect(takenA11y("15:00")).toBe("15:00, только что заняли");
  });

  it("joins the duration with a non-breaking space", () => {
    expect(serviceMeta(60)).toBe(`60${NBSP}мин`);
  });
});

describe("submitState", () => {
  const ready: SubmitInput = {
    client: "ready",
    serviceId: "s1",
    start: START,
    today: "2026-11-02",
    timeZone: TZ,
    online: true,
    busy: false,
  };

  it("asks for the first missing piece, in order", () => {
    expect(submitState({ ...ready, client: "none", serviceId: null, start: null }).label).toBe("Выберите клиента");
    expect(submitState({ ...ready, client: "invalidPhone", serviceId: null }).label).toBe("Проверьте номер телефона");
    expect(submitState({ ...ready, client: "needsName", serviceId: null }).label).toBe("Напишите имя клиента");
    expect(submitState({ ...ready, serviceId: null, start: null }).label).toBe("Выберите услугу");
    expect(submitState({ ...ready, start: null })).toEqual({ label: "Выберите время", enabled: false });
  });

  it("is enabled when everything is set", () => {
    expect(submitState(ready)).toEqual({ label: "Записать · завтра, 15:00", enabled: true });
  });

  it("keeps the label but disables offline or while busy", () => {
    expect(submitState({ ...ready, online: false })).toEqual({ label: "Записать · завтра, 15:00", enabled: false });
    expect(submitState({ ...ready, busy: true })).toEqual({ label: "Записать · завтра, 15:00", enabled: false });
  });
});

describe("timeChoices", () => {
  const a = "2026-11-03T10:00:00+05:00";
  const b = "2026-11-03T11:30:00+05:00";
  const c = "2026-11-03T14:00:00+05:00";

  it("sorts free times", () => {
    const list = timeChoices([c, a, b], null, null, TZ);
    expect(list.map((t) => t.label)).toEqual(["10:00", "11:30", "14:00"]);
    expect(list.every((t) => t.state === "free")).toBe(true);
  });

  it("marks the selected time", () => {
    expect(timeChoices([a, b], b, null, TZ).map((t) => t.state)).toEqual(["free", "selected"]);
  });

  it("inserts a missing taken time in order", () => {
    const list = timeChoices([a, c], null, b, TZ);
    expect(list.map((t) => [t.label, t.state])).toEqual([
      ["10:00", "free"],
      ["11:30", "taken"],
      ["14:00", "free"],
    ]);
  });

  it("keeps taken even when it is also selected", () => {
    expect(timeChoices([a, b], b, b, TZ).map((t) => t.state)).toEqual(["free", "taken"]);
  });
});

describe("grid helpers", () => {
  it("splits into rows", () => {
    expect(chunk([1, 2, 3, 4, 5], 4)).toEqual([[1, 2, 3, 4], [5]]);
  });

  it("uses fewer columns at a large font", () => {
    expect(chipColumns(1)).toBe(4);
    expect(chipColumns(1.3)).toBe(3);
  });
});
