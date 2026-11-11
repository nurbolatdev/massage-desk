import { describe, expect, it, jest } from "@jest/globals";

import { createApi } from "@/lib/api/client";

import type { TimeOffItem } from "./timeOff";
import { fetchTimeOff, toTimeOffPeriods } from "./timeOff";

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
