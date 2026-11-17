// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { useSaveService, useServices } from "./hooks";
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

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("useServices", () => {
  it("loads GET /services and keeps the server order", async () => {
    const payload = [
      { id: "b", name: "Б", durationMin: 60, price: 8000, sortOrder: 0, active: true },
      { id: "a", name: "А", durationMin: 45, price: 6000, sortOrder: 1, active: false },
    ];
    respond.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const { result } = renderHook(() => useServices(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(payload);
    expect(respond).toHaveBeenCalledTimes(1);
    expect(respond.mock.calls[0]?.[0].url).toBe("https://api.test/services");
  });

  it("fails with ApiError on 500", async () => {
    respond.mockResolvedValueOnce(
      new Response("{}", { status: 500, headers: { "Content-Type": "application/json" } }),
    );

    const { result } = renderHook(() => useServices(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error).toMatchObject({ status: 500 });
  });
});

describe("useSaveService", () => {
  const back = { id: "s1", name: "Массаж спины", durationMin: 60, price: 8000, sortOrder: 0, active: true };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  function setup() {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });
    client.setQueryData(queryKeys.services, [back]);
    client.setQueryData(queryKeys.slots.one("s1", "2026-11-20"), []);
    client.setQueryData(queryKeys.appointments.range("2026-11-16", "2026-11-22"), []);
    const wrap = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
    return { client, wrap };
  }

  it("creates with POST and appends to the cache", async () => {
    const created = { id: "s2", name: "Массаж рук", durationMin: 40, price: 7500, sortOrder: 1, active: true };
    respond.mockResolvedValueOnce(json(created, 201));
    const { client, wrap } = setup();
    const { result } = renderHook(() => useSaveService(), { wrapper: wrap });

    result.current.mutate({ id: null, body: { name: "Массаж рук", durationMin: 40, price: 7500 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const request = respond.mock.calls[0]?.[0];
    expect(request?.method).toBe("POST");
    expect(request?.url).toBe("https://api.test/services");
    expect(await request?.json()).toEqual({ name: "Массаж рук", durationMin: 40, price: 7500 });
    expect(client.getQueryData(queryKeys.services)).toEqual([back, created]);
  });

  it("updates with PATCH, replaces in place and invalidates dependent caches", async () => {
    const saved = { ...back, price: 9000 };
    respond.mockResolvedValue(json(saved));
    const { client, wrap } = setup();
    const { result } = renderHook(() => useSaveService(), { wrapper: wrap });

    result.current.mutate({ id: "s1", body: { price: 9000 } });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const request = respond.mock.calls[0]?.[0];
    expect(request?.method).toBe("PATCH");
    expect(request?.url).toBe("https://api.test/services/s1");
    expect(await request?.json()).toEqual({ price: 9000 });
    expect(client.getQueryData(queryKeys.services)).toEqual([saved]);
    await waitFor(() => {
      expect(client.getQueryState(queryKeys.slots.one("s1", "2026-11-20"))?.isInvalidated).toBe(true);
    });
    expect(
      client.getQueryState(queryKeys.appointments.range("2026-11-16", "2026-11-22"))?.isInvalidated,
    ).toBe(true);
  });

  it("fails with the code of a 404 and still drops the slots", async () => {
    respond.mockResolvedValue(json({ code: "SERVICE_NOT_FOUND" }, 404));
    const { client, wrap } = setup();
    const { result } = renderHook(() => useSaveService(), { wrapper: wrap });

    result.current.mutate({ id: "s1", body: { active: false } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.error).toMatchObject({ code: "SERVICE_NOT_FOUND" });
    await waitFor(() => {
      expect(client.getQueryState(queryKeys.slots.one("s1", "2026-11-20"))?.isInvalidated).toBe(true);
    });
  });
});
