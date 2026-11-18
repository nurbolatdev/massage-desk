import { describe, expect, it, vi } from "vitest";

import { createApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import {
  DRAG_CANCELLED,
  DRAG_HINT,
  DRAG_INSTRUCTIONS,
  KEYBOARD_HINT,
  RESCHEDULE_BACK,
  RESCHEDULE_CONFIRM,
  RESCHEDULE_PICK_AGAIN,
  RESCHEDULE_TITLE,
  dragMoveText,
  dragStartText,
  dropText,
  pickedText,
  rescheduleAppointment,
  rescheduleErrorKind,
  rescheduleErrorText,
  rescheduleText,
  slotLines,
  whenShort,
} from "./reschedule";
import type { Appointment } from "./schedule";

function problem(status: number, code?: string) {
  return async () =>
    new Response(code ? JSON.stringify({ code }) : null, {
      status,
      headers: { "Content-Type": "application/problem+json" },
    });
}

function setup(respond: () => Promise<Response>) {
  const fetch = vi.fn<(input: Request) => Promise<Response>>(respond);
  const api = createApi({
    baseUrl: "https://api.test",
    getAccessToken: async () => "tok",
    onUnauthorized: vi.fn(),
    fetch,
  });
  return { fetch, api };
}

async function errorOf(status: number, code?: string): Promise<unknown> {
  const { api } = setup(problem(status, code));
  try {
    await rescheduleAppointment(api, "a1", new Date("2026-11-03T05:00:00Z"));
  } catch (e) {
    return e;
  }
  throw new Error("expected failure");
}

describe("rescheduleAppointment", () => {
  it("posts the new start as ISO", async () => {
    const { fetch, api } = setup(async () => new Response("{}", { status: 200 }));
    await rescheduleAppointment(api, "a1", new Date("2026-11-03T05:00:00Z"));
    const request = fetch.mock.calls[0]?.[0];
    expect(request?.method).toBe("POST");
    expect(request?.url).toBe("https://api.test/appointments/a1/reschedule");
    expect(await request?.text()).toBe('{"start":"2026-11-03T05:00:00.000Z"}');
  });
});

describe("rescheduleErrorKind", () => {
  it("maps TIME_TAKEN to taken", async () => {
    expect(rescheduleErrorKind(await errorOf(409, "TIME_TAKEN"))).toBe("taken");
  });
  it("maps a 409 without a known code to taken", async () => {
    expect(rescheduleErrorKind(await errorOf(409))).toBe("taken");
  });
  it("maps NOT_CONFIRMED to gone", async () => {
    expect(rescheduleErrorKind(await errorOf(409, "NOT_CONFIRMED"))).toBe("gone");
  });
  it("maps 404 to gone", async () => {
    expect(rescheduleErrorKind(await errorOf(404, "APPOINTMENT_NOT_FOUND"))).toBe("gone");
  });
  it("maps OUTSIDE_SCHEDULE to outside", async () => {
    expect(rescheduleErrorKind(await errorOf(422, "OUTSIDE_SCHEDULE"))).toBe("outside");
  });
  it("maps a network error to offline", () => {
    expect(rescheduleErrorKind(new ApiError("network"))).toBe("offline");
  });
  it("maps 500 and unknown errors to failed", async () => {
    expect(rescheduleErrorKind(await errorOf(500))).toBe("failed");
    expect(rescheduleErrorKind(new Error("boom"))).toBe("failed");
  });
});

const TZ = "Asia/Tashkent";
const MON_START = new Date("2026-11-02T11:00:00Z");
const MON_END = new Date("2026-11-02T12:00:00Z");
const THU_START = new Date("2026-11-05T11:00:00Z");
const SUN_START = new Date("2026-11-08T11:00:00Z");
const SUN_END = new Date("2026-11-08T12:00:00Z");

const MARAT: Appointment = {
  id: "a1",
  clientId: "c1",
  clientName: "Марат Каримов",
  clientPhone: "+77010000000",
  serviceId: "s1",
  serviceName: "Общий",
  start: MON_START,
  end: MON_END,
  status: "confirmed",
  source: "manual",
};

describe("reschedule texts", () => {
  it("exposes dialog and hint labels", () => {
    expect(RESCHEDULE_TITLE).toBe("Перенести запись?");
    expect(RESCHEDULE_CONFIRM).toBe("Перенести");
    expect(RESCHEDULE_BACK).toBe("Вернуть как было");
    expect(DRAG_HINT).toBe("Перетащите запись на другое время. Занятое время и перерывы не принимают запись.");
    expect(KEYBOARD_HINT).toBe("С клавиатуры: пробел — взять запись, стрелки — сдвинуть, Enter — поставить, Esc — отменить.");
    expect(DRAG_INSTRUCTIONS).toBe(
      "Чтобы перенести запись, нажмите пробел. Стрелки вверх и вниз сдвигают запись на 15 минут, влево и вправо — на день. Enter — поставить, Esc — отменить.",
    );
    expect(DRAG_CANCELLED).toBe("Перенос отменён. Запись на месте.");
  });

  it("formats slot lines including Sunday", () => {
    expect(slotLines(MON_START, MON_END, TZ)).toEqual({ day: "пн 2 нояб.", time: "16:00–17:00" });
    expect(slotLines(SUN_START, SUN_END, TZ)).toEqual({ day: "вс 8 нояб.", time: "16:00–17:00" });
  });

  it("formats short date and time", () => {
    expect(whenShort(THU_START, TZ)).toBe("чт 5 нояб., 16:00");
  });

  it("formats confirmation text with client name", () => {
    expect(rescheduleText("Марат Каримов")).toBe(
      "Вы перетащили запись: Марат Каримов. Клиенту сообщение не придёт — если нужно, напишите ему сами.",
    );
  });

  it("formats panel reschedule label and confirmation text", () => {
    expect(RESCHEDULE_PICK_AGAIN).toBe("Выбрать другое время");
    expect(pickedText("Марат Каримов")).toBe(
      "Вы выбрали новое время для записи: Марат Каримов. Клиенту сообщение не придёт — если нужно, напишите ему сами.",
    );
  });

  it("maps every error kind to a Russian message", () => {
    expect(rescheduleErrorText("taken", THU_START, TZ)).toBe("16:00 уже занято. Выберите другое время.");
    expect(rescheduleErrorText("outside", THU_START, TZ)).toBe("Это время уже нельзя записать. Выберите другое время.");
    expect(rescheduleErrorText("gone", THU_START, TZ)).toBe("Запись уже изменилась. Закройте окно — на экране новое состояние.");
    expect(rescheduleErrorText("offline", THU_START, TZ)).toBe("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
    expect(rescheduleErrorText("failed", THU_START, TZ)).toBe("Не получилось перенести. Попробуйте ещё раз через минуту.");
  });

  it("formats screen-reader drag announcements", () => {
    expect(dragStartText(MARAT, TZ)).toBe("Запись: Марат Каримов, пн 2 нояб., 16:00. Двигайте стрелками.");
    expect(dragMoveText(THU_START, TZ)).toBe("Новое время: чт 5 нояб., 16:00.");
    expect(dropText(THU_START, TZ)).toBe("Новое время: чт 5 нояб., 16:00. Подтвердите перенос.");
    expect(dropText(null, TZ)).toBe(DRAG_CANCELLED);
  });
});
