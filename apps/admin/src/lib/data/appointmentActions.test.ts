import { describe, expect, it, vi } from "vitest";

import { createApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import {
  ACTION_DIALOG,
  CANCEL_LABEL,
  NO_SHOW_LABEL,
  actionErrorKind,
  actionErrorText,
  actionText,
  panelActions,
  postAppointmentAction,
} from "./appointmentActions";
import { whenShort } from "./reschedule";
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
    await postAppointmentAction(api, "a1", "noShow");
  } catch (e) {
    return e;
  }
  throw new Error("expected failure");
}

const TZ = "Asia/Tashkent";
const START = new Date("2026-11-02T05:00:00Z");
const END = new Date("2026-11-02T06:00:00Z");

const AIGUL: Appointment = {
  id: "a1",
  clientId: "c1",
  clientName: "Айгуль Сапарова",
  clientPhone: "+77010000000",
  serviceId: "s1",
  serviceName: "Спина",
  start: START,
  end: END,
  status: "confirmed",
  source: "manual",
};

describe("postAppointmentAction", () => {
  it("calls cancel endpoint with path id", async () => {
    const { api } = setup(async () => new Response('{"id":"a1","status":"cancelled"}', { status: 200 }));
    const post = vi.spyOn(api, "POST");
    const res = await postAppointmentAction(api, "a1", "cancel");
    expect(post).toHaveBeenCalledWith("/appointments/{id}/cancel", { params: { path: { id: "a1" } } });
    expect(res).toEqual({ id: "a1", status: "cancelled" });
  });

  it("calls no-show endpoint with path id", async () => {
    const { api } = setup(async () => new Response('{"id":"a1","status":"no_show"}', { status: 200 }));
    const post = vi.spyOn(api, "POST");
    const res = await postAppointmentAction(api, "a1", "noShow");
    expect(post).toHaveBeenCalledWith("/appointments/{id}/no-show", { params: { path: { id: "a1" } } });
    expect(res).toEqual({ id: "a1", status: "no_show" });
  });
});

describe("panelActions", () => {
  it("allows only cancel before start for confirmed", () => {
    expect(panelActions(AIGUL, new Date("2026-11-02T04:59:59Z"))).toEqual({ cancel: true, noShow: false });
  });

  it("allows cancel and noShow at exact start and after for confirmed", () => {
    expect(panelActions(AIGUL, START)).toEqual({ cancel: true, noShow: true });
    expect(panelActions(AIGUL, new Date("2026-11-02T05:30:00Z"))).toEqual({ cancel: true, noShow: true });
  });

  it("disallows both for non-confirmed statuses", () => {
    for (const status of ["cancelled", "done", "no_show"] as const) {
      expect(panelActions({ ...AIGUL, status }, END)).toEqual({ cancel: false, noShow: false });
    }
  });
});

describe("action texts", () => {
  it("exposes button and dialog labels", () => {
    expect(CANCEL_LABEL).toBe("Отменить");
    expect(NO_SHOW_LABEL).toBe("Не пришёл");
    expect(ACTION_DIALOG.cancel).toEqual({
      title: "Отменить запись?",
      confirm: "Отменить запись",
      back: "Не отменять",
    });
    expect(ACTION_DIALOG.noShow).toEqual({
      title: "Клиент не пришёл?",
      confirm: "Да, не пришёл",
      back: "Нет, оставить",
    });
  });

  it("formats confirmation text for cancel and noShow", () => {
    const when = whenShort(START, TZ);
    expect(actionText("cancel", AIGUL, TZ)).toBe(
      `Айгуль Сапарова, ${when} · Спина. Время станет свободным для бота. Клиенту сообщение не придёт — если нужно, напишите ему сами.`,
    );
    expect(actionText("noShow", AIGUL, TZ)).toBe(
      `Айгуль Сапарова, ${when} · Спина. Запись отметится как «не пришёл». Это видно в истории клиента и в отчётах.`,
    );
  });
});

describe("actionErrorKind and actionErrorText", () => {
  it("maps every error category", async () => {
    expect(actionErrorKind(new Error())).toBe("failed");
    expect(actionErrorKind(new ApiError("network"))).toBe("offline");
    expect(actionErrorKind(await errorOf(409, "NOT_STARTED"))).toBe("early");
    expect(actionErrorKind(await errorOf(409, "NOT_CONFIRMED"))).toBe("gone");
    expect(actionErrorKind(await errorOf(404, "APPOINTMENT_NOT_FOUND"))).toBe("gone");
    expect(actionErrorKind(await errorOf(500))).toBe("failed");
  });

  it("returns Russian message for each error kind", () => {
    expect(actionErrorText("gone")).toBe("Запись уже изменилась. Закройте окно — на экране новое состояние.");
    expect(actionErrorText("early")).toBe("Запись ещё не началась. Отметить «не пришёл» можно после её начала.");
    expect(actionErrorText("offline")).toBe("Нет связи с сервером. Проверьте интернет и попробуйте ещё раз.");
    expect(actionErrorText("failed")).toBe("Не получилось сохранить. Попробуйте ещё раз через минуту.");
  });
});
