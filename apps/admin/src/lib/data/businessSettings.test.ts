import { describe, expect, it } from "vitest";

import { ApiError, type AppointmentConflict } from "@/lib/api/errors";

import {
  businessDraft,
  isDirty,
  type Settings,
  settingsBody,
  settingsSaveErrorKind,
  settingsSaveErrorText,
  zoneConfirmText,
  zoneConflictText,
  zoneName,
  zoneOffset,
  zoneOptions,
} from "./businessSettings";

const NOW = new Date("2026-11-17T12:00:00Z");

const settings: Settings = { timeZone: "Asia/Almaty", address: "ул. Абая, 1", botEnabled: true };

const conflict: AppointmentConflict = {
  appointmentId: "a1",
  clientName: null,
  start: "2026-11-20T10:00:00+05:00",
  end: "2026-11-20T11:00:00+05:00",
};

describe("zoneOffset", () => {
  it("formats the offset from tzdata", () => {
    expect(zoneOffset("Asia/Tashkent", NOW)).toBe("UTC+5");
    expect(zoneOffset("Asia/Bishkek", NOW)).toBe("UTC+6");
    expect(zoneOffset("Europe/Moscow", NOW)).toBe("UTC+3");
    expect(zoneOffset("Asia/Almaty", NOW)).toMatch(/^UTC\+\d$/);
    expect(zoneOffset("Asia/Kolkata", NOW)).toBe("UTC+5:30");
    expect(zoneOffset("UTC", NOW)).toBe("UTC");
    expect(zoneOffset("Etc/UTC", NOW)).toBe("UTC");
  });

  it("returns null for an unknown zone", () => {
    expect(zoneOffset("Not/AZone", NOW)).toBeNull();
  });
});

describe("zoneOptions", () => {
  it("lists the four zones in the mockup order", () => {
    const options = zoneOptions("Asia/Tashkent", NOW);
    expect(options.map((o) => o.id)).toEqual(["Asia/Almaty", "Asia/Tashkent", "Asia/Bishkek", "Europe/Moscow"]);
    expect(options.map((o) => o.label)).toEqual(["Алматы, Астана", "Ташкент", "Бишкек", "Москва"]);
  });

  it("adds a current zone outside the list last, named by its id", () => {
    const options = zoneOptions("Europe/Berlin", NOW);
    expect(options).toHaveLength(5);
    expect(options[4]).toEqual({ id: "Europe/Berlin", label: "Europe/Berlin", offset: "UTC+1" });
  });
});

describe("zoneName", () => {
  it("adds the offset in brackets when known", () => {
    expect(zoneName({ id: "Europe/Moscow", label: "Москва", offset: "UTC+3" })).toBe("Москва (UTC+3)");
    expect(zoneName({ id: "X/Y", label: "X/Y", offset: null })).toBe("X/Y");
  });
});

describe("draft and body", () => {
  it("turns a null address into an empty field", () => {
    expect(businessDraft({ ...settings, address: null })).toEqual({ address: "", timeZone: "Asia/Almaty" });
  });

  it("sends nothing when nothing changed", () => {
    expect(settingsBody(settings, businessDraft(settings), false)).toEqual({});
    expect(isDirty(settings, businessDraft(settings))).toBe(false);
  });

  it("trims the address", () => {
    const draft = { ...businessDraft(settings), address: "  ул. Абая, 2  " };
    expect(settingsBody(settings, draft, false)).toEqual({ address: "ул. Абая, 2" });
    expect(isDirty(settings, draft)).toBe(true);
  });

  it("clears the address with an empty string", () => {
    const draft = { ...businessDraft(settings), address: "" };
    expect(settingsBody(settings, draft, false)).toEqual({ address: "" });
  });

  it("ignores spaces around the same address", () => {
    const draft = { ...businessDraft(settings), address: "  ул. Абая, 1 " };
    expect(settingsBody(settings, draft, false)).toEqual({});
    expect(isDirty(settings, draft)).toBe(false);
  });

  it("sends a new zone and force only when asked", () => {
    const draft = { address: "ул. Абая, 2", timeZone: "Europe/Moscow" };
    expect(settingsBody(settings, { ...draft, address: settings.address ?? "" }, false)).toEqual({
      timeZone: "Europe/Moscow",
    });
    const body = settingsBody(settings, draft, true);
    expect(body).toEqual({ address: "ул. Абая, 2", timeZone: "Europe/Moscow", force: true });
    expect(body).not.toHaveProperty("botEnabled");
    expect(settingsBody(settings, draft, false)).not.toHaveProperty("force");
  });
});

describe("settingsSaveErrorKind", () => {
  it("classifies errors", () => {
    expect(settingsSaveErrorKind(new ApiError("network"))).toBe("offline");
    expect(
      settingsSaveErrorKind(new ApiError("problem", { status: 409, code: "APPOINTMENT_CONFLICT", conflicts: [conflict] })),
    ).toBe("conflict");
    expect(settingsSaveErrorKind(new ApiError("problem", { status: 409, code: "APPOINTMENT_CONFLICT" }))).toBe(
      "failed",
    );
    expect(settingsSaveErrorKind(new ApiError("problem", { status: 400, code: "UNKNOWN_TIME_ZONE" }))).toBe(
      "unknownZone",
    );
    expect(settingsSaveErrorKind(new ApiError("problem", { status: 400, code: "INVALID_REQUEST" }))).toBe("invalid");
    expect(settingsSaveErrorKind(new ApiError("server", { status: 500 }))).toBe("failed");
    expect(settingsSaveErrorKind(new Error("x"))).toBe("failed");
  });

  it("words the failed error with and without a code", () => {
    expect(settingsSaveErrorText("failed", new ApiError("server", { status: 500 }))).toBe(
      "Сервер ответил с ошибкой. Код: 500. Настройки не сохранены.",
    );
    expect(settingsSaveErrorText("failed", new Error("x"))).toBe(
      "Настройки не сохранены. Попробуйте ещё раз через минуту.",
    );
  });
});

describe("texts", () => {
  it("declines the conflict text", () => {
    expect(zoneConflictText(1)).toBe(
      "1 запись окажется вне часов работы в новом поясе. Запись останется — её нужно перенести или отменить самим.",
    );
    expect(zoneConflictText(2)).toBe(
      "2 записи окажутся вне часов работы в новом поясе. Записи останутся — их нужно перенести или отменить самим.",
    );
    expect(zoneConflictText(5)).toContain("5 записей окажутся");
  });

  it("names the zone in the confirmation", () => {
    expect(zoneConfirmText("Москва (UTC+3)")).toBe(
      "Всё время в приложении и в сообщениях бота будет показываться по поясу «Москва (UTC+3)». Записи не переносятся, но их время на экране изменится.",
    );
  });
});
