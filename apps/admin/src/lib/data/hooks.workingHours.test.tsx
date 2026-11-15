// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import { ApiError, type AppointmentConflict } from "@/lib/api/errors";

import { useSaveWorkingHours, useWorkingHours } from "./hooks";
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

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("useWorkingHours", () => {
  it("loads GET /working-hours", async () => {
    const payload = { blocks: [{ weekday: 1, start: "09:00", end: "18:00" }] };
    respond.mockResolvedValueOnce(
      new Response(JSON.stringify(payload), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const client = makeClient();
    const { result } = renderHook(() => useWorkingHours(), { wrapper: makeWrapper(client) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(payload);
    expect(respond.mock.calls[0]?.[0].url).toBe("https://api.test/working-hours");
  });
});

describe("useSaveWorkingHours", () => {
  it("updates workingHours cache and invalidates slots on success", async () => {
    const saved = { blocks: [{ weekday: 1, start: "10:00", end: "17:00" }] };
    respond.mockResolvedValueOnce(
      new Response(JSON.stringify(saved), { status: 200, headers: { "Content-Type": "application/json" } }),
    );

    const client = makeClient();
    client.setQueryData(queryKeys.workingHours, { blocks: [{ weekday: 1, start: "09:00", end: "18:00" }] });
    client.setQueryData(queryKeys.slots.one("s1", "2026-11-02"), ["09:00", "10:00"]);

    const { result } = renderHook(() => useSaveWorkingHours(), { wrapper: makeWrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ blocks: saved.blocks, force: false });
    });

    expect(client.getQueryData(queryKeys.workingHours)).toEqual(saved);
    expect(client.getQueryState(queryKeys.slots.one("s1", "2026-11-02"))?.isInvalidated).toBe(true);
  });

  it("exposes ApiError with conflicts and leaves workingHours cache unchanged on 409", async () => {
    const initial = { blocks: [{ weekday: 1, start: "09:00", end: "18:00" }] };
    const conflicts: AppointmentConflict[] = [
      {
        appointmentId: "a1",
        clientName: "Айгуль Сапарова",
        start: "2026-11-07T10:00:00+05:00",
        end: "2026-11-07T11:00:00+05:00",
      },
    ];
    respond.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "APPOINTMENT_CONFLICT", conflicts }), {
        status: 409,
        headers: { "Content-Type": "application/problem+json" },
      }),
    );

    const client = makeClient();
    client.setQueryData(queryKeys.workingHours, initial);

    const { result } = renderHook(() => useSaveWorkingHours(), { wrapper: makeWrapper(client) });

    act(() => {
      result.current.mutate({ blocks: [], force: false });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
    if (result.current.error instanceof ApiError) {
      expect(result.current.error.conflicts).toEqual(conflicts);
    }
    expect(client.getQueryData(queryKeys.workingHours)).toEqual(initial);
  });
});
