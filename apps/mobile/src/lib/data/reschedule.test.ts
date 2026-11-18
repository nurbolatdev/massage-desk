import { describe, expect, it } from "@jest/globals";

import type { Appointment } from "@/types";

import { ApiError } from "../api/errors";
import { ACTION_CONFLICT, ACTION_FAILED } from "./appointmentCard";
import {
  NEW_DAY,
  NEW_TIME,
  NOW_LABEL,
  RESCHEDULE_CONFIRM_TITLE,
  RESCHEDULE_CONFIRM_YES,
  RESCHEDULE_GONE_TEXT,
  RESCHEDULE_GONE_TITLE,
  RESCHEDULE_LABEL,
  RESCHEDULE_OFFLINE_TEXT,
  RESCHEDULE_TITLE,
  clientServiceLine,
  currentLine,
  rescheduleConfirmText,
  rescheduleDay,
  rescheduleErrorKind,
  rescheduleLabel,
  rescheduleSheetErrorText,
  shortWhen,
} from "./reschedule";

const TZ = "Asia/Tashkent";
const FROM = new Date("2026-11-02T05:00:00Z");
const TO = new Date("2026-11-03T06:30:00Z");

const appt: Appointment = {
  id: "a1",
  clientId: "c1",
  clientName: "Айгуль Сапарова",
  clientPhone: "+998901234567",
  serviceId: "s1",
  serviceName: "Массаж спины",
  start: FROM,
  end: new Date("2026-11-02T06:00:00Z"),
  status: "confirmed",
  source: "bot",
};

describe("texts", () => {
  it("match the mockup", () => {
    expect(RESCHEDULE_TITLE).toBe("Перенос записи");
    expect(NOW_LABEL).toBe("Сейчас");
    expect(NEW_DAY).toBe("Новый день");
    expect(NEW_TIME).toBe("Новое время");
    expect(RESCHEDULE_LABEL).toBe("Перенести");
    expect(RESCHEDULE_CONFIRM_TITLE).toBe("Перенести запись?");
    expect(RESCHEDULE_CONFIRM_YES).toBe("Да, перенести");
    expect(RESCHEDULE_OFFLINE_TEXT).toBe("Перенести запись можно, когда телефон подключится к интернету.");
    expect(RESCHEDULE_GONE_TITLE).toBe("Запись уже изменилась");
    expect(RESCHEDULE_GONE_TEXT).toBe("Её больше нельзя перенести. Вернитесь к карточке записи.");
  });
});

describe("lines", () => {
  it("currentLine", () => {
    expect(currentLine(FROM, TZ)).toBe("Пн, 2 ноября · 10:00");
  });

  it("clientServiceLine uses the booked length", () => {
    expect(clientServiceLine(appt)).toBe("Айгуль Сапарова · Массаж спины, 60 мин");
  });

  it("shortWhen always has the date", () => {
    expect(shortWhen(TO, TZ)).toBe("вт, 3 нояб., 11:30");
  });

  it("rescheduleLabel", () => {
    expect(rescheduleLabel(TO, TZ)).toBe("Перенести на вт, 3 нояб., 11:30");
  });

  it("rescheduleConfirmText", () => {
    expect(rescheduleConfirmText(FROM, TO, TZ)).toBe(
      "Запись переедет с пн, 2 нояб., 10:00 на вт, 3 нояб., 11:30. Клиенту сообщение не придёт — если нужно, напишите ему сами.",
    );
  });
});

describe("rescheduleErrorKind", () => {
  it("maps NOT_CONFIRMED 409 to conflict", () => {
    expect(rescheduleErrorKind(new ApiError("problem", { status: 409, code: "NOT_CONFIRMED" }))).toBe("conflict");
  });

  it("maps 404 to conflict", () => {
    expect(rescheduleErrorKind(new ApiError("problem", { status: 404 }))).toBe("conflict");
  });

  it("maps TIME_TAKEN 409 to taken", () => {
    expect(rescheduleErrorKind(new ApiError("problem", { status: 409, code: "TIME_TAKEN" }))).toBe("taken");
  });

  it("maps a 409 without a code to taken", () => {
    expect(rescheduleErrorKind(new ApiError("problem", { status: 409 }))).toBe("taken");
  });

  it("maps OUTSIDE_SCHEDULE 422 to outside", () => {
    expect(rescheduleErrorKind(new ApiError("problem", { status: 422, code: "OUTSIDE_SCHEDULE" }))).toBe("outside");
  });

  it("maps a 500 to failed", () => {
    expect(rescheduleErrorKind(new ApiError("server", { status: 500 }))).toBe("failed");
  });

  it("maps a non-ApiError to failed", () => {
    expect(rescheduleErrorKind(new Error("boom"))).toBe("failed");
  });
});

describe("rescheduleSheetErrorText", () => {
  it("uses the conflict text for conflict", () => {
    expect(rescheduleSheetErrorText(new ApiError("problem", { status: 404 }))).toBe(ACTION_CONFLICT);
  });

  it("uses the failure text otherwise", () => {
    expect(rescheduleSheetErrorText(new ApiError("network"))).toBe(ACTION_FAILED);
    expect(rescheduleSheetErrorText(new ApiError("problem", { status: 409, code: "TIME_TAKEN" }))).toBe(ACTION_FAILED);
  });
});

describe("rescheduleDay", () => {
  const choices = [
    { day: "2026-11-02", label: "Сегодня" },
    { day: "2026-11-03", label: "Завтра" },
  ];

  it("keeps the appointment day when offered", () => {
    expect(rescheduleDay("2026-11-03", choices, "2026-11-02")).toBe("2026-11-03");
  });

  it("falls back to today", () => {
    expect(rescheduleDay("2026-12-01", choices, "2026-11-02")).toBe("2026-11-02");
  });
});
