// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";

import { useDaySlots } from "./hooks";
import { queryKeys } from "./queryKeys";

const respond = vi.hoisted(() => vi.fn<(r: Request) => Promise<Response>>());

vi.mock("@/lib/api", () => ({
  api: createApi({
    baseUrl: "https://api.test",
    getAccessToken: async () => "tok",
    onUnauthorized: () => {},
    fetch: (r) => respond(r),
  }),
  unwrap,
}));

const DAY = "2026-11-03";
const TZ = "Asia/Tashkent";

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("useDaySlots", () => {
  it("keeps the free times with and without the excluded appointment in separate cache entries", async () => {
    respond.mockImplementation(async (r) => {
      const excluded = new URL(r.url).searchParams.get("excludeAppointmentId");
      const starts = excluded === "a1" ? ["2026-11-03T09:30:00+05:00"] : ["2026-11-03T10:00:00+05:00"];
      return new Response(
        JSON.stringify({ day: DAY, durationMin: 60, starts, timeZone: TZ }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => ({
        plain: useDaySlots("s1", DAY),
        excluding: useDaySlots("s1", DAY, "a1"),
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.plain.isSuccess).toBe(true);
      expect(result.current.excluding.isSuccess).toBe(true);
    });

    expect(result.current.plain.data).toEqual([new Date("2026-11-03T10:00:00+05:00")]);
    expect(result.current.excluding.data).toEqual([new Date("2026-11-03T09:30:00+05:00")]);
    expect(client.getQueryData(queryKeys.slots.one("s1", DAY))).toBeDefined();
    expect(client.getQueryData(queryKeys.slots.one("s1", DAY, "a1"))).toBeDefined();
    expect(respond).toHaveBeenCalledTimes(2);

    const urls = respond.mock.calls.map(([r]) => new URL(r.url));
    expect(urls.filter((u) => u.searchParams.get("excludeAppointmentId") === "a1")).toHaveLength(1);
    expect(urls.filter((u) => !u.searchParams.has("excludeAppointmentId"))).toHaveLength(1);
  });
});
