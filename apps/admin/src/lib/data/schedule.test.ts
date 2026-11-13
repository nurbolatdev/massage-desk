import { describe, expect, it, vi } from "vitest";

import { createApi } from "@/lib/api/client";

import { fetchAppointments, toAppointments, toTimeOffPeriods, weekRange } from "./schedule";
import type { AppointmentListItem } from "./schedule";

function item(over: Partial<AppointmentListItem>): AppointmentListItem {
  return {
    id: "a1",
    clientId: "c1",
    clientName: "Айгуль",
    clientPhone: "+77010000000",
    serviceId: "s1",
    serviceName: "Массаж спины",
    start: "2026-11-03T05:00:00Z",
    end: "2026-11-03T06:00:00Z",
    status: "CONFIRMED",
    source: "BOT",
    ...over,
  } as AppointmentListItem;
}

describe("toAppointments", () => {
  it("sorts by start and falls back to the phone for the name", () => {
    const result = toAppointments([
      item({ id: "late", start: "2026-11-03T09:00:00Z" }),
      item({ id: "early", clientName: null }),
    ]);
    expect(result.map((a) => a.id)).toEqual(["early", "late"]);
    expect(result[0]?.clientName).toBe("+77010000000");
    expect(result[0]?.start).toEqual(new Date("2026-11-03T05:00:00Z"));
  });
});

describe("toTimeOffPeriods", () => {
  it("makes dates and sorts by start", () => {
    const result = toTimeOffPeriods([
      { id: "b", start: "2026-11-10T00:00:00Z", end: "2026-11-11T00:00:00Z" },
      { id: "a", start: "2026-11-05T00:00:00Z", end: "2026-11-06T00:00:00Z" },
    ] as never);
    expect(result.map((p) => p.id)).toEqual(["a", "b"]);
    expect(result[0]?.end).toEqual(new Date("2026-11-06T00:00:00Z"));
  });
});

describe("weekRange", () => {
  it("returns Monday to Sunday for a Wednesday", () => {
    expect(weekRange("2026-11-04")).toEqual({ from: "2026-11-02", to: "2026-11-08" });
  });
  it("keeps a Monday as the start", () => {
    expect(weekRange("2026-11-02")).toEqual({ from: "2026-11-02", to: "2026-11-08" });
  });
  it("keeps a Sunday as the end", () => {
    expect(weekRange("2026-11-08")).toEqual({ from: "2026-11-02", to: "2026-11-08" });
  });
});

describe("fetchAppointments", () => {
  it("requests /appointments with the range", async () => {
    const fetch = vi.fn<(input: Request) => Promise<Response>>(
      async () =>
        new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } }),
    );
    const api = createApi({
      baseUrl: "https://api.test",
      getAccessToken: async () => "tok",
      onUnauthorized: vi.fn(),
      fetch,
    });
    await fetchAppointments(api, "2026-11-02", "2026-11-08");
    expect(fetch.mock.calls[0]?.[0].url).toBe(
      "https://api.test/appointments?from=2026-11-02&to=2026-11-08",
    );
  });
});
