import { describe, expect, it, vi } from "vitest";

import { createApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { whenShort } from "./reschedule";
import {
  DAY_CHOICES,
  PICK_DAY_HINT,
  SERVICE_HIDDEN,
  choiceDay,
  dayPick,
  fetchSlots,
  pickableDay,
  pickerText,
  slotsErrorText,
  slotsRetryable,
  slotsView,
  toStarts,
} from "./rescheduleTime";
import type { Appointment } from "./schedule";

const TZ = "Asia/Tashkent";
const TODAY = "2026-11-02";

const AIGUL: Appointment = {
  id: "a1",
  clientId: "c1",
  clientName: "Айгуль Сапарова",
  clientPhone: "+77010000000",
  serviceId: "s1",
  serviceName: "Массаж спины",
  start: new Date("2026-11-02T05:00:00Z"),
  end: new Date("2026-11-02T06:00:00Z"),
  status: "confirmed",
  source: "manual",
};

function setup(respond: () => Promise<Response>) {
  const fetch = vi.fn<(input: Request) => Promise<Response>>(respond);
  const api = createApi({
    baseUrl: "https://api.test",
    getAccessToken: async () => "tok",
    onUnauthorized: vi.fn(),
    fetch,
  });
  return { api };
}

describe("fetchSlots and toStarts", () => {
  it("requests /slots with serviceId and day", async () => {
    const body = { day: "2026-11-03", durationMin: 60, starts: ["2026-11-03T09:00:00+05:00"], timeZone: TZ };
    const { api } = setup(async () => new Response(JSON.stringify(body), { status: 200 }));
    const get = vi.spyOn(api, "GET");
    const res = await fetchSlots(api, "s1", "2026-11-03");
    expect(get).toHaveBeenCalledWith("/slots", { params: { query: { serviceId: "s1", day: "2026-11-03" } } });
    expect(res).toEqual(body);
  });

  it("maps ISO slot strings to Date instances", () => {
    const starts = toStarts({
      day: "2026-11-03",
      durationMin: 60,
      starts: ["2026-11-03T09:00:00+05:00"],
      timeZone: TZ,
    });
    expect(starts).toEqual([new Date("2026-11-03T04:00:00Z")]);
  });
});

describe("dayPick, choiceDay and pickableDay", () => {
  it("maps past, today, tomorrow and later days to segments", () => {
    expect(DAY_CHOICES).toEqual([
      ["today", "Сегодня"],
      ["tomorrow", "Завтра"],
      ["other", "Другое число"],
    ]);
    expect(dayPick("2026-11-01", TODAY)).toEqual({ choice: "today", day: TODAY });
    expect(dayPick(TODAY, TODAY)).toEqual({ choice: "today", day: TODAY });
    expect(dayPick("2026-11-03", TODAY)).toEqual({ choice: "tomorrow", day: "2026-11-03" });
    expect(dayPick("2026-11-10", TODAY)).toEqual({ choice: "other", day: "2026-11-10" });
  });

  it("resolves day for all three choices", () => {
    expect(choiceDay("today", TODAY, "2026-11-10")).toBe(TODAY);
    expect(choiceDay("tomorrow", TODAY, "2026-11-10")).toBe("2026-11-03");
    expect(choiceDay("other", TODAY, "2026-11-10")).toBe("2026-11-10");
  });

  it("validates pickable days", () => {
    expect(pickableDay("", TODAY)).toBe(false);
    expect(pickableDay("2026-11-01", TODAY)).toBe(false);
    expect(pickableDay("2026-02-30", TODAY)).toBe(false);
    expect(pickableDay(TODAY, TODAY)).toBe(true);
    expect(pickableDay("2026-11-03", TODAY)).toBe(true);
  });
});

describe("slotsView", () => {
  const someStarts = [new Date("2026-11-02T10:00:00Z")];

  it("covers all six states", () => {
    expect(slotsView({ day: "2026-11-01", today: TODAY, online: true, starts: undefined, error: null })).toBe("pickDay");
    expect(slotsView({ day: TODAY, today: TODAY, online: false, starts: undefined, error: null })).toBe("offline");
    expect(slotsView({ day: TODAY, today: TODAY, online: true, starts: undefined, error: null })).toBe("loading");
    expect(slotsView({ day: TODAY, today: TODAY, online: true, starts: undefined, error: new Error() })).toBe("error");
    expect(slotsView({ day: TODAY, today: TODAY, online: true, starts: [], error: null })).toBe("empty");
    expect(slotsView({ day: TODAY, today: TODAY, online: true, starts: someStarts, error: null })).toBe("ready");
  });

  it("respects state priority", () => {
    expect(slotsView({ day: TODAY, today: TODAY, online: false, starts: someStarts, error: null })).toBe("offline");
    expect(slotsView({ day: TODAY, today: TODAY, online: true, starts: someStarts, error: new Error() })).toBe("ready");
    expect(slotsView({ day: "2026-11-01", today: TODAY, online: false, starts: someStarts, error: null })).toBe(
      "pickDay",
    );
  });
});

describe("slotsErrorText, slotsRetryable and pickerText", () => {
  it("handles hidden service and network/server errors", () => {
    const hidden = new ApiError("problem", { status: 404, code: "SERVICE_NOT_FOUND" });
    expect(slotsErrorText(hidden)).toBe(SERVICE_HIDDEN);
    expect(slotsRetryable(hidden)).toBe(false);

    const net = new ApiError("network");
    expect(slotsErrorText(net)).toBe("Нет связи с сервером. Проверьте интернет и нажмите «Повторить».");
    expect(slotsRetryable(net)).toBe(true);

    const server = new ApiError("server", { status: 500 });
    expect(slotsErrorText(server)).toBe("Сервер ответил с ошибкой. Код: 500.");
    expect(slotsRetryable(server)).toBe(true);
  });

  it("formats picker subtitle with client name and current start", () => {
    expect(PICK_DAY_HINT).toBe("Выберите день не раньше сегодняшнего.");
    expect(pickerText(AIGUL, TZ)).toBe(
      `Айгуль Сапарова, сейчас ${whenShort(AIGUL.start, TZ)}. Выберите новый день и время.`,
    );
    expect(pickerText(AIGUL, TZ)).toBe("Айгуль Сапарова, сейчас пн 2 нояб., 10:00. Выберите новый день и время.");
  });
});
