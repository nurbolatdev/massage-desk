import { describe, expect, it, vi } from "vitest";

import { createApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { whenShort } from "./reschedule";
import {
  DAY_CHOICES,
  PICK_DAY_HINT,
  SERVICE_HIDDEN,
  TIMES_EMPTY,
  TIMES_LOADING,
  choiceDay,
  dayPick,
  daySlotsOptions,
  fetchSlots,
  pickableDay,
  pickerText,
  slotsErrorText,
  slotsRetry,
  slotsRetryable,
  slotsStatusText,
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

describe("slotsStatusText", () => {
  it("returns status copy for text states and null for non-text states", () => {
    expect(slotsStatusText("loading")).toBe(TIMES_LOADING);
    expect(slotsStatusText("empty")).toBe(TIMES_EMPTY);
    expect(slotsStatusText("pickDay")).toBe(PICK_DAY_HINT);
    expect(slotsStatusText("offline")).toBeNull();
    expect(slotsStatusText("error")).toBeNull();
    expect(slotsStatusText("ready")).toBeNull();
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

describe("slotsRetry and daySlotsOptions", () => {
  it("stops retrying on 4xx and retries network, 5xx and unknown errors up to 3 times", () => {
    expect(slotsRetry(0, new ApiError("problem", { status: 404, code: "SERVICE_NOT_FOUND" }))).toBe(false);
    expect(slotsRetry(0, new ApiError("problem", { status: 400 }))).toBe(false);
    expect(slotsRetry(0, new ApiError("problem", { status: 409 }))).toBe(false);
    expect(slotsRetry(0, new ApiError("unauthorized", { status: 401 }))).toBe(false);

    const net = new ApiError("network");
    expect(slotsRetry(0, net)).toBe(true);
    expect(slotsRetry(2, net)).toBe(true);
    expect(slotsRetry(3, net)).toBe(false);

    const server = new ApiError("server", { status: 500 });
    expect(slotsRetry(0, server)).toBe(true);
    expect(slotsRetry(2, server)).toBe(true);
    expect(slotsRetry(3, server)).toBe(false);

    expect(slotsRetry(0, new Error("x"))).toBe(true);
  });

  it("configures daySlotsOptions with disabled null day, zero gc/stale times and slotsRetry", () => {
    const load = vi.fn();
    const opts = daySlotsOptions("s1", null, load);
    expect(opts.enabled).toBe(false);
    expect(opts.gcTime).toBe(0);
    expect(opts.staleTime).toBe(0);
    expect(opts.retry).toBe(slotsRetry);
    expect(opts.queryKey).toEqual(["slots", "s1", ""]);
  });
});
