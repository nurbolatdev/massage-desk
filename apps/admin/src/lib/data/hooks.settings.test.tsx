// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import { ApiError, type AppointmentConflict } from "@/lib/api/errors";

import { useSaveSettings, useWorkingHours } from "./hooks";
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

const before = { timeZone: "Asia/Almaty", address: null, botEnabled: true };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

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

function seed(client: QueryClient) {
  client.setQueryData(queryKeys.settings, before);
  client.setQueryData(queryKeys.slots.one("s1", "2026-11-18"), ["09:00"]);
  client.setQueryData(queryKeys.appointments.range("2026-11-16", "2026-11-22"), []);
  client.setQueryData(queryKeys.timeOff.range("2026-11-16", "2026-11-22"), []);
  client.setQueryData(queryKeys.workingHours, { blocks: [] });
  client.setQueryData(queryKeys.clients.one("c1"), { id: "c1" });
}

function invalidated(client: QueryClient): boolean[] {
  return [
    queryKeys.slots.one("s1", "2026-11-18"),
    queryKeys.appointments.range("2026-11-16", "2026-11-22"),
    queryKeys.timeOff.range("2026-11-16", "2026-11-22"),
    queryKeys.workingHours,
    queryKeys.clients.one("c1"),
  ].map((key) => client.getQueryState(key)?.isInvalidated === true);
}

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("useSaveSettings", () => {
  it("patches only the address and leaves the lists alone", async () => {
    const saved = { ...before, address: "ул. Абая, 2" };
    respond.mockResolvedValueOnce(json(saved));
    const client = makeClient();
    seed(client);
    const { result } = renderHook(() => useSaveSettings(), { wrapper: makeWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ address: "ул. Абая, 2" });
    });

    const request = respond.mock.calls[0]?.[0];
    expect(request?.method).toBe("PATCH");
    expect(request?.url).toBe("https://api.test/settings");
    expect(await request?.json()).toEqual({ address: "ул. Абая, 2" });
    expect(client.getQueryData(queryKeys.settings)).toEqual(saved);
    expect(invalidated(client)).toEqual([false, false, false, false, false]);
  });

  it("invalidates every zone-dependent list when the zone changes", async () => {
    const saved = { ...before, timeZone: "Europe/Moscow" };
    respond.mockResolvedValueOnce(json(saved));
    const client = makeClient();
    seed(client);
    const { result } = renderHook(() => useSaveSettings(), { wrapper: makeWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ timeZone: "Europe/Moscow" });
    });

    expect(client.getQueryData(queryKeys.settings)).toEqual(saved);
    expect(invalidated(client)).toEqual([true, true, true, true, true]);
  });

  it("exposes the conflicts and keeps the cached settings on 409", async () => {
    const conflicts: AppointmentConflict[] = [
      {
        appointmentId: "a1",
        clientName: "Айгуль",
        start: "2026-11-20T10:00:00+05:00",
        end: "2026-11-20T11:00:00+05:00",
      },
    ];
    respond.mockResolvedValueOnce(json({ code: "APPOINTMENT_CONFLICT", conflicts }, 409));
    const client = makeClient();
    seed(client);
    const { result } = renderHook(() => useSaveSettings(), { wrapper: makeWrapper(client) });

    act(() => {
      result.current.mutate({ timeZone: "Europe/Moscow" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    if (result.current.error instanceof ApiError) {
      expect(result.current.error.conflicts).toEqual(conflicts);
    }
    expect(client.getQueryData(queryKeys.settings)).toEqual(before);
  });

  it("does not wait for the lists to reload", async () => {
    let gets = 0;
    respond.mockImplementation((req) => {
      if (req.method === "PATCH") return Promise.resolve(json({ ...before, timeZone: "Europe/Moscow" }));
      gets += 1;
      return gets === 1 ? Promise.resolve(json({ blocks: [] })) : new Promise<Response>(() => {});
    });
    const client = makeClient();
    renderHook(() => useWorkingHours(), { wrapper: makeWrapper(client) });
    await waitFor(() => expect(client.getQueryState(queryKeys.workingHours)?.status).toBe("success"));
    const { result } = renderHook(() => useSaveSettings(), { wrapper: makeWrapper(client) });

    act(() => {
      result.current.mutate({ timeZone: "Europe/Moscow" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(gets).toBe(2));
  });
});
