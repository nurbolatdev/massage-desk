import { describe, expect, it } from "@jest/globals";

import type { Appointment } from "@/types";

import { NBSP } from "../format";
import {
  TIME_FREED,
  appointmentRouteParams,
  cardDayTitle,
  detailRows,
  durationText,
  initials,
  timeRange,
} from "./appointmentCard";

const TZ = "Asia/Tashkent";

const appt: Appointment = {
  id: "a1",
  clientId: "c1",
  clientName: "Анна",
  clientPhone: "+998901234567",
  serviceName: "Классический массаж",
  start: new Date("2026-11-02T05:00:00Z"),
  end: new Date("2026-11-02T06:00:00Z"),
  status: "confirmed",
  source: "bot",
};

describe("timeRange", () => {
  it("joins start and end with an en dash", () => {
    expect(timeRange(appt.start, appt.end, TZ)).toBe("10:00 – 11:00");
  });
});

describe("cardDayTitle", () => {
  const start = new Date("2026-11-02T05:00:00Z");

  it("has no prefix on the same day", () => {
    expect(cardDayTitle(start, new Date("2026-11-02T07:00:00Z"), TZ)).toBe("Понедельник, 2 ноября");
  });

  it("prefixes yesterday", () => {
    expect(cardDayTitle(start, new Date("2026-11-03T07:00:00Z"), TZ)).toBe("Вчера, понедельник, 2 ноября");
  });

  it("has no prefix for tomorrow", () => {
    expect(cardDayTitle(new Date("2026-11-03T05:00:00Z"), new Date("2026-11-02T07:00:00Z"), TZ)).toBe(
      "Вторник, 3 ноября",
    );
  });
});

describe("durationText", () => {
  it("picks the plural form", () => {
    expect(durationText(1)).toBe(`1${NBSP}минута`);
    expect(durationText(2)).toBe(`2${NBSP}минуты`);
    expect(durationText(5)).toBe(`5${NBSP}минут`);
    expect(durationText(60)).toBe(`60${NBSP}минут`);
  });
});

describe("initials", () => {
  it("takes the first letters of the first two words", () => {
    expect(initials("Айгуль Сапарова")).toBe("АС");
    expect(initials("Анна Мария Ли")).toBe("АМ");
  });

  it("upper-cases a lower-case name", () => {
    expect(initials("олег")).toBe("О");
  });

  it("is empty for a phone", () => {
    expect(initials("+998901234567")).toBe("");
  });
});

describe("detailRows", () => {
  it("shows service, duration and author for a confirmed bot booking", () => {
    expect(detailRows(appt)).toEqual([
      { label: "Услуга", value: "Классический массаж", bot: false },
      { label: "Длительность", value: `60${NBSP}минут`, bot: false },
      { label: "Кто записал", value: "Бот", bot: true },
    ]);
  });

  it("marks a manual booking without the bot flag", () => {
    const rows = detailRows({ ...appt, source: "manual" });
    expect(rows[2]).toEqual({ label: "Кто записал", value: "Вы, вручную", bot: false });
  });

  it("shows the same rows for done", () => {
    expect(detailRows({ ...appt, status: "done" }).map((r) => r.label)).toEqual([
      "Услуга",
      "Длительность",
      "Кто записал",
    ]);
  });

  it("shows service and freed time for cancelled", () => {
    expect(detailRows({ ...appt, status: "cancelled" })).toEqual([
      { label: "Услуга", value: "Классический массаж", bot: false },
      { label: "Время", value: TIME_FREED, bot: false },
    ]);
  });

  it("shows service and author for no-show", () => {
    expect(detailRows({ ...appt, status: "no_show" }).map((r) => r.label)).toEqual(["Услуга", "Кто записал"]);
  });
});

describe("appointmentRouteParams", () => {
  it("uses the day in the master's zone", () => {
    const a = { ...appt, start: new Date("2026-11-01T20:00:00Z") };
    expect(appointmentRouteParams(a, TZ)).toEqual({ id: "a1", day: "2026-11-02" });
  });
});
