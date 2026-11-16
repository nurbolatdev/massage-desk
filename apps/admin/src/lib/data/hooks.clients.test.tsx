// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";

import type { Client } from "./clients";
import { useClients } from "./hooks";

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
  cleanup();
});

describe("useClients", () => {
  it("requests GET /clients with limit=50, offset=0, and no q when term is empty", async () => {
    const rows = [makeRow("c1")];
    respond.mockResolvedValueOnce(jsonResponse(rows));

    const { result } = renderHook(() => useClients(""), { wrapper: makeWrapper(makeClient()) });

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

    const { result } = renderHook(() => useClients("Айг"), { wrapper: makeWrapper(makeClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const url = new URL(respond.mock.calls[0]?.[0].url ?? "");
    expect(url.searchParams.get("q")).toBe("Айг");
  });

  it("loads next page at offset=50 and stops when page has fewer than 50 rows", async () => {
    const page1 = Array.from({ length: 50 }, (_, i) => makeRow(`p1-${i}`));
    const page2 = Array.from({ length: 10 }, (_, i) => makeRow(`p2-${i}`));
    respond.mockResolvedValueOnce(jsonResponse(page1)).mockResolvedValueOnce(jsonResponse(page2));

    const { result } = renderHook(() => useClients(""), { wrapper: makeWrapper(makeClient()) });

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
