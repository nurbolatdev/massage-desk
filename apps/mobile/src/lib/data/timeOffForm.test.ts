import { describe, expect, it } from "@jest/globals";

import { ApiError } from "@/lib/api/errors";
import type { AppointmentConflict } from "@/lib/api/errors";

import {
  conflictMessage,
  EMPTY_PICK,
  pickDay,
  pickErrorText,
  PAST_DAY_TEXT,
  TOO_FAR_TEXT,
  TOO_LONG_TEXT,
  timeOffErrorKind,
  timeOffKind,
  timeOffTitle,
} from "./timeOffForm";

const today = "2026-11-13";

describe("pickDay", () => {
  it("rejects a past day and keeps the pick", () => {
    const pick = { from: "2026-12-01", to: "2026-12-01", error: null };
    expect(pickDay(pick, "2026-11-12", today)).toEqual({ ...pick, error: "past" });
    expect(pickDay(EMPTY_PICK, "2026-11-12", today)).toEqual({ ...EMPTY_PICK, error: "past" });
  });

  it("allows today and today + 729, rejects today + 730", () => {
    expect(pickDay(EMPTY_PICK, today, today).from).toBe(today);
    expect(pickDay(EMPTY_PICK, "2028-11-11", today).from).toBe("2028-11-11");
    expect(pickDay(EMPTY_PICK, "2028-11-12", today)).toEqual({ ...EMPTY_PICK, error: "tooFar" });
  });

  it("clears the only picked day when tapped again", () => {
    const one = pickDay(EMPTY_PICK, "2026-12-15", today);
    expect(one).toEqual({ from: "2026-12-15", to: "2026-12-15", error: null });
    expect(pickDay(one, "2026-12-15", today)).toEqual(EMPTY_PICK);
  });

  it("replaces the pick with another day and clears the error", () => {
    const pick = { from: "2026-12-15", to: "2026-12-15", error: "past" as const };
    expect(pickDay(pick, "2026-12-20", today)).toEqual({ from: "2026-12-20", to: "2026-12-20", error: null });
  });
});

describe("pickErrorText", () => {
  it("has a text per error", () => {
    expect(pickErrorText("past")).toBe(PAST_DAY_TEXT);
    expect(pickErrorText("tooFar")).toBe(TOO_FAR_TEXT);
    expect(pickErrorText("tooLong")).toBe(TOO_LONG_TEXT);
  });
});

describe("timeOffTitle", () => {
  it("writes one day, a range in a month and a range across months", () => {
    expect(timeOffTitle("2026-12-15", "2026-12-15")).toBe("15 декабря");
    expect(timeOffTitle("2026-12-15", "2026-12-22")).toBe("15 – 22 декабря");
    expect(timeOffTitle("2026-12-30", "2027-01-05")).toBe("30 декабря – 5 января");
  });
});

describe("timeOffKind", () => {
  it("names a day off and a vacation with the day count", () => {
    expect(timeOffKind("2026-12-15", "2026-12-15")).toBe("Выходной");
    expect(timeOffKind("2026-12-15", "2026-12-16")).toBe("Отпуск · 2 дня");
    expect(timeOffKind("2026-12-15", "2026-12-19")).toBe("Отпуск · 5 дней");
    expect(timeOffKind("2026-12-01", "2026-12-21")).toBe("Отпуск · 21 день");
    expect(timeOffKind("2026-12-15", "2026-12-22")).toBe("Отпуск · 8 дней");
  });
});

const conflict = (name: string | null, start: string): AppointmentConflict => ({
  appointmentId: start,
  clientName: name,
  start,
  end: start,
});

describe("timeOffErrorKind", () => {
  it("tells conflict, invalid and failed apart", () => {
    const withConflict = new ApiError("problem", {
      status: 409,
      code: "APPOINTMENT_CONFLICT",
      conflicts: [conflict("A", "2026-12-15T11:00:00+05:00")],
    });
    expect(timeOffErrorKind(withConflict)).toBe("conflict");
    expect(timeOffErrorKind(new ApiError("problem", { status: 409, code: "APPOINTMENT_CONFLICT", conflicts: [] }))).toBe(
      "failed",
    );
    expect(timeOffErrorKind(new ApiError("problem", { status: 422, code: "INVALID_TIME_OFF" }))).toBe("invalid");
    expect(timeOffErrorKind(new ApiError("problem", { status: 400, code: "INVALID_REQUEST" }))).toBe("invalid");
    expect(timeOffErrorKind(new ApiError("network"))).toBe("failed");
    expect(timeOffErrorKind(new ApiError("server", { status: 500 }))).toBe("failed");
  });
});

describe("conflictMessage", () => {
  const zone = "Asia/Almaty";

  it("describes one appointment", () => {
    expect(conflictMessage([conflict("Ержан Бекенов", "2026-12-15T11:00:00+05:00")], zone)).toEqual({
      day: "15 декабря",
      rest: " уже есть 1 запись (Ержан Бекенов, 11:00). Перенесите её или отмените.",
    });
  });

  it("names the first of several on one day", () => {
    const list = [
      conflict("Позже", "2026-12-15T15:00:00+05:00"),
      conflict("Ержан Бекенов", "2026-12-15T11:00:00+05:00"),
      conflict("Третий", "2026-12-15T17:00:00+05:00"),
    ];
    expect(conflictMessage(list, zone)).toEqual({
      day: "15 декабря",
      rest: " уже есть 3 записи (первая — Ержан Бекенов, 11:00). Перенесите их или отмените.",
    });
  });

  it("mentions other days when the days differ", () => {
    const list = [
      conflict("Ержан Бекенов", "2026-12-15T11:00:00+05:00"),
      conflict("Б", "2026-12-16T11:00:00+05:00"),
      conflict("В", "2026-12-16T12:00:00+05:00"),
      conflict("Г", "2026-12-17T12:00:00+05:00"),
      conflict("Д", "2026-12-18T12:00:00+05:00"),
    ];
    expect(conflictMessage(list, zone)).toEqual({
      day: "15 декабря",
      rest: " и в другие дни уже есть 5 записей (первая — Ержан Бекенов, 11:00). Перенесите их или отмените.",
    });
  });

  it("falls back for a client without a name", () => {
    expect(conflictMessage([conflict(null, "2026-12-15T11:00:00+05:00")], zone).rest).toContain(
      "клиент без имени, 11:00",
    );
  });

  it("shows the day and time in the master's zone", () => {
    const result = conflictMessage([conflict("А", "2026-12-15T22:30:00Z")], zone);
    expect(result.day).toBe("16 декабря");
    expect(result.rest).toContain("03:30");
  });
});
