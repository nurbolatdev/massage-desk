import { describe, expect, it } from "@jest/globals";

import type { Appointment } from "@/types";

import { ApiError } from "../api/errors";
import { NBSP } from "../format";
import {
  ACTION_CONFLICT,
  ACTION_FAILED,
  TIME_FREED,
  actionErrorText,
  appointmentRouteParams,
  cancelConfirmText,
  cardLoad,
  cardActions,
  cardDayTitle,
  detailRows,
  durationText,
  initials,
  statusChip,
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

describe("cardActions", () => {
  it("offers only cancel before the start", () => {
    const now = new Date("2026-11-02T04:00:00Z");
    expect(cardActions(appt, now)).toEqual({ cancel: true, noShow: false });
  });

  it("offers both at the start", () => {
    expect(cardActions(appt, appt.start)).toEqual({ cancel: true, noShow: true });
  });

  it("offers both after the end", () => {
    expect(cardActions(appt, new Date("2026-11-02T08:00:00Z"))).toEqual({ cancel: true, noShow: true });
  });

  it.each(["cancelled", "no_show", "done"] as const)("offers nothing for %s", (status) => {
    const now = new Date("2026-11-02T08:00:00Z");
    expect(cardActions({ ...appt, status }, now)).toEqual({ cancel: false, noShow: false });
  });
});

describe("actionErrorText", () => {
  it("explains a conflict", () => {
    expect(actionErrorText(new ApiError("problem", { status: 409 }))).toBe(ACTION_CONFLICT);
  });

  it("falls back to the failed text", () => {
    expect(actionErrorText(new ApiError("network"))).toBe(ACTION_FAILED);
    expect(actionErrorText(new Error())).toBe(ACTION_FAILED);
  });
});

describe("cancelConfirmText", () => {
  it("says what will happen", () => {
    expect(cancelConfirmText(new Date("2026-11-02T05:00:00Z"), TZ)).toBe(
      "Запись на 2 ноября в 10:00 отменится, время станет свободным для бота. Клиенту сообщение не придёт — если нужно, напишите ему сами.",
    );
  });
});

describe("cardLoad", () => {
  const failure = new Error("x");
  const base = { appointmentsLoaded: true, settingsLoaded: true, settingsError: null, appointmentsError: null };

  it("has data only when the list and the settings are both present", () => {
    expect(cardLoad(base).hasData).toBe(true);
    expect(cardLoad({ ...base, settingsLoaded: false }).hasData).toBe(false);
    expect(cardLoad({ ...base, appointmentsLoaded: false }).hasData).toBe(false);
  });

  it("reports a settings error as the error", () => {
    expect(cardLoad({ ...base, settingsLoaded: false, settingsError: failure }).error).toBe(failure);
  });

  it("reports a list error as the error", () => {
    expect(cardLoad({ ...base, appointmentsError: failure }).error).toBe(failure);
  });

  it("has no error when nothing failed", () => {
    expect(cardLoad(base)).toEqual({ hasData: true, error: null });
  });
});

describe("statusChip", () => {
  it("has no chip without a status or for a confirmed appointment", () => {
    expect(statusChip(undefined)).toBeUndefined();
    expect(statusChip("confirmed")).toBeUndefined();
  });

  it("has a chip for cancelled, no_show and done", () => {
    expect(statusChip("cancelled")).toBe("cancelled");
    expect(statusChip("no_show")).toBe("no_show");
    expect(statusChip("done")).toBe("done");
  });
});
