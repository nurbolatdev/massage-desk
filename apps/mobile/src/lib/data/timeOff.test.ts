import { describe, expect, it, jest } from "@jest/globals";

import { createApi } from "@/lib/api/client";

import type { TimeOffItem } from "./timeOff";
import { createTimeOff, dayRangePeriod, fetchTimeOff, toTimeOffPeriods } from "./timeOff";

const item: TimeOffItem = {
  id: "t1",
  start: "2026-11-08T00:00:00+05:00",
  end: "2026-11-09T00:00:00+05:00",
  reason: "Отпуск",
};

describe("toTimeOffPeriods", () => {
  it("keeps the instant and drops the reason", () => {
    const [period] = toTimeOffPeriods([item]);
    expect(period).toEqual({
      id: "t1",
      start: new Date("2026-11-07T19:00:00.000Z"),
      end: new Date("2026-11-08T19:00:00.000Z"),
    });
  });

  it("sorts by start", () => {
    const later: TimeOffItem = { ...item, id: "t2", start: "2026-11-10T00:00:00+05:00" };
    expect(toTimeOffPeriods([later, item]).map((p) => p.id)).toEqual(["t1", "t2"]);
  });
});

describe("fetchTimeOff", () => {
  it("calls GET /time-off with the range", async () => {
    const fetch = jest.fn<(input: Request) => Promise<Response>>(
      async () => new Response(JSON.stringify([item]), { status: 200 }),
    );
    const api = createApi({
      baseUrl: "https://api.test",
      getAccessToken: async () => "tok",
      onUnauthorized: jest.fn(),
      fetch,
    });
    const data = await fetchTimeOff(api, "2026-11-02", "2026-11-08");
    expect(fetch.mock.calls[0]?.[0].url).toBe(
      "https://api.test/time-off?from=2026-11-02&to=2026-11-08",
    );
    expect(data).toEqual([item]);
  });
});

describe("createTimeOff", () => {
  it("posts the period, with force only when given", async () => {
    const fetch = jest.fn<(input: Request) => Promise<Response>>(
      async () => new Response(JSON.stringify(item), { status: 201 }),
    );
    const api = createApi({
      baseUrl: "https://api.test",
      getAccessToken: async () => "tok",
      onUnauthorized: jest.fn(),
      fetch,
    });
    const period = { start: "2026-12-14T19:00:00.000Z", end: "2026-12-15T19:00:00.000Z" };
    await createTimeOff(api, period);
    await createTimeOff(api, { ...period, force: true });
    const [first, second] = fetch.mock.calls.map((c) => c[0]);
    expect(first?.method).toBe("POST");
    expect(first?.url).toBe("https://api.test/time-off");
    expect(await first?.json()).toEqual(period);
    expect(await second?.json()).toEqual({ ...period, force: true });
  });
});

describe("dayRangePeriod", () => {
  it("runs from local midnight to the midnight after the last day", () => {
    expect(dayRangePeriod("2026-12-15", "2026-12-22", "Asia/Almaty")).toEqual({
      start: "2026-12-14T19:00:00.000Z",
      end: "2026-12-22T19:00:00.000Z",
    });
  });

  it("is 24 hours for one day without DST", () => {
    const { start, end } = dayRangePeriod("2026-12-15", "2026-12-15", "Asia/Almaty");
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(24 * 3600 * 1000);
  });

  it("ends at local midnight across a DST change", () => {
    const { start, end } = dayRangePeriod("2026-03-28", "2026-03-29", "Europe/Berlin");
    expect(start).toBe("2026-03-27T23:00:00.000Z");
    expect(end).toBe("2026-03-29T22:00:00.000Z");
  });
});
