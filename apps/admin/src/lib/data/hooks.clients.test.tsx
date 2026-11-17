// @vitest-environment jsdom
import { onlineManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import type { Client } from "./clients";
import { useClient, useClients, useClientsSummary, useSaveClientNote } from "./hooks";
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

function makeClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
}

function makeWrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

function makeRow(id: string): Client {
  return {
    id,
    phone: "+77012345678",
    name: "Айгуль Сапарова",
    notes: null,
    createdAt: "2025-10-12T10:00:00+05:00",
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  onlineManager.setOnline(true);
  cleanup();
});

describe("useClients", () => {
  it("requests GET /clients with limit=50, offset=0, and no q when term is empty", async () => {
    const rows = [makeRow("c1")];
    respond.mockResolvedValueOnce(jsonResponse(rows));

    const { result } = renderHook(() => useClients("", "all"), { wrapper: makeWrapper(makeClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toEqual([rows]);

    const url = new URL(respond.mock.calls[0]?.[0].url ?? "");
    expect(url.pathname).toBe("/clients");
    expect(url.searchParams.has("q")).toBe(false);
    expect(url.searchParams.get("limit")).toBe("50");
    expect(url.searchParams.get("offset")).toBe("0");
  });

  it("passes q when term is non-empty", async () => {
    respond.mockResolvedValueOnce(jsonResponse([]));

    const { result } = renderHook(() => useClients("Айг", "all"), { wrapper: makeWrapper(makeClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = new URL(respond.mock.calls[0]?.[0].url ?? "");
    expect(url.searchParams.get("q")).toBe("Айг");
  });

  it("sends segment only when it is not all", async () => {
    respond.mockResolvedValueOnce(jsonResponse([])).mockResolvedValueOnce(jsonResponse([]));

    const all = renderHook(() => useClients("", "all"), { wrapper: makeWrapper(makeClient()) });
    await waitFor(() => expect(all.result.current.isSuccess).toBe(true));
    expect(new URL(respond.mock.calls[0]?.[0].url ?? "").searchParams.has("segment")).toBe(false);

    const seg = renderHook(() => useClients("Айг", "no_shows"), {
      wrapper: makeWrapper(makeClient()),
    });
    await waitFor(() => expect(seg.result.current.isSuccess).toBe(true));
    const url = new URL(respond.mock.calls[1]?.[0].url ?? "");
    expect(url.searchParams.get("q")).toBe("Айг");
    expect(url.searchParams.get("segment")).toBe("no_shows");
  });

  it("loads next page at offset=50 and stops when page has fewer than 50 rows", async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => makeRow(`p1-${i}`));
    const page2 = Array.from({ length: 10 }, (_, i) => makeRow(`p2-${i}`));
    respond.mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2));

    const { result } = renderHook(() => useClients("", "all"), { wrapper: makeWrapper(makeClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    const url2 = new URL(respond.mock.calls[1]?.[0].url ?? "");
    expect(url2.searchParams.get("offset")).toBe("50");
    expect(result.current.hasNextPage).toBe(false);
  });
});

describe("useClient", () => {
  it("requests GET /clients/{id} and returns the client", async () => {
    const client = { ...makeRow("c1"), notes: "Болит шея" };
    respond.mockResolvedValueOnce(jsonResponse(client));

    const { result } = renderHook(() => useClient("c1"), { wrapper: makeWrapper(makeClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(client);
    expect(respond.mock.calls[0]?.[0].url).toBe("https://api.test/clients/c1");
    expect(respond.mock.calls[0]?.[0].method).toBe("GET");
  });
});

describe("useClientsSummary", () => {
  it("requests GET /clients/summary", async () => {
    const summary = { total: 142, newLast30Days: 9 };
    respond.mockResolvedValueOnce(jsonResponse(summary));

    const { result } = renderHook(() => useClientsSummary(), {
      wrapper: makeWrapper(makeClient()),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(summary);
    expect(respond.mock.calls[0]?.[0].url).toBe("https://api.test/clients/summary");
  });
});

describe("useSaveClientNote", () => {
  it("sends PATCH /clients/{id} and updates one and all cached list queries", async () => {
    const c0 = makeRow("c0");
    const c1 = makeRow("c1");
    const saved = { ...c1, notes: "Болит шея" };
    respond.mockResolvedValueOnce(jsonResponse(saved));

    const qc = makeClient();
    qc.setQueryData(queryKeys.clients.list("", "all"), { pages: [[c0, c1]], pageParams: [0] });
    qc.setQueryData(queryKeys.clients.list("Айг", "all"), { pages: [[c0, c1]], pageParams: [0] });

    const { result } = renderHook(() => useSaveClientNote("c1"), { wrapper: makeWrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync("Болит шея  ");
    });

    const req = respond.mock.calls[0]?.[0];
    expect(req?.url).toBe("https://api.test/clients/c1");
    expect(req?.method).toBe("PATCH");
    expect(await req?.json()).toEqual({ notes: "Болит шея  " });

    expect(qc.getQueryData(queryKeys.clients.one("c1"))).toEqual(saved);

    for (const term of ["", "Айг"]) {
      const cached = qc.getQueryData<{ pages: Client[][] }>(queryKeys.clients.list(term, "all"));
      expect(cached?.pages[0]?.[0]).toBe(c0);
      expect(cached?.pages[0]?.[1]).toEqual(saved);
    }
  });

  it("keeps the stats of cached list rows", async () => {
    const stats = {
      visits: 3,
      lastVisitAt: null,
      nextAppointmentAt: null,
      noShows: 0,
      totalSpent: 0,
      visitIntervalDays: null,
    };
    const row = { ...makeRow("c1"), stats };
    respond.mockResolvedValueOnce(jsonResponse({ ...makeRow("c1"), notes: "Новая" }));

    const qc = makeClient();
    qc.setQueryData(queryKeys.clients.list("", "all"), { pages: [[row]], pageParams: [0] });

    const { result } = renderHook(() => useSaveClientNote("c1"), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync("Новая");
    });

    const cached = qc.getQueryData<{ pages: (typeof row)[][] }>(queryKeys.clients.list("", "all"));
    expect(cached?.pages[0]?.[0]).toEqual({ ...row, notes: "Новая" });
  });

  it("rejects with a network ApiError even while offlineManager is offline", async () => {
    onlineManager.setOnline(false);
    respond.mockRejectedValueOnce(new TypeError("offline"));

    const { result } = renderHook(() => useSaveClientNote("c1"), {
      wrapper: makeWrapper(makeClient()),
    });

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.mutateAsync("Текст");
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBeInstanceOf(ApiError);
    if (caught instanceof ApiError) {
      expect(caught.kind).toBe("network");
    }
  });
});
