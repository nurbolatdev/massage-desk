// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";

import { useClientHistory, useClientStats } from "./hooks";

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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
}

function rows(n: number, from: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `a${from + i}`,
    start: "2026-10-12T10:00:00+05:00",
    end: "2026-10-12T11:00:00+05:00",
    serviceName: "Спина",
    status: "done",
  }));
}

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("useClientStats", () => {
  it("loads GET /clients/{id}/stats", async () => {
    const stats = { visits: 6, totalSpent: 52000, noShows: 0, lastVisitAt: null, nextAppointmentAt: null, visitIntervalDays: 14 };
    respond.mockResolvedValueOnce(json(stats));
    const { result } = renderHook(() => useClientStats("c1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(stats);
    expect(respond.mock.calls[0]?.[0].url).toBe("https://api.test/clients/c1/stats");
  });
});

describe("useClientHistory", () => {
  it("pages by 10 until a short page", async () => {
    respond.mockResolvedValueOnce(json(rows(10, 0))).mockResolvedValueOnce(json(rows(4, 10)));
    const { result } = renderHook(() => useClientHistory("c1"), { wrapper });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    expect(respond.mock.calls[0]?.[0].url).toBe("https://api.test/clients/c1/appointments?limit=10&offset=0");
    await result.current.fetchNextPage();
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(respond.mock.calls[1]?.[0].url).toBe("https://api.test/clients/c1/appointments?limit=10&offset=10");
    expect(result.current.hasNextPage).toBe(false);
  });
});
