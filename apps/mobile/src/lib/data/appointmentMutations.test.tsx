import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { useAppointmentAction, useRescheduleAppointment } from "./hooks";
import { queryKeys } from "./queryKeys";

type Call = (path: string, init?: unknown) => Promise<unknown>;

const mockPost = jest.fn<Call>();

jest.mock("@/lib/api", () => ({
  api: { POST: (path: string, init?: unknown) => mockPost(path, init) },
  unwrap: jest.requireActual<typeof import("@/lib/api/client")>("@/lib/api/client").unwrap,
  ApiError: jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors").ApiError,
}));

const DAY = "2026-11-03";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity } },
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function seed() {
  queryClient.setQueryData(queryKeys.appointments.range(DAY, DAY), []);
  queryClient.setQueryData(queryKeys.appointment.one("a1"), {});
  queryClient.setQueryData(queryKeys.slots.one("s1", DAY), {});
}

function invalidated(key: readonly unknown[]) {
  return queryClient.getQueryState(key)?.isInvalidated;
}

describe("appointment mutations refresh the single appointment", () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockPost.mockResolvedValue({
      data: { id: "a1", status: "cancelled" },
      response: new Response(null, { status: 200 }),
    });
    seed();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("cancel invalidates the day list and the appointment", async () => {
    const { result } = await renderHook(() => useAppointmentAction(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "a1", action: "cancel" });
    });
    expect(invalidated(queryKeys.appointments.range(DAY, DAY))).toBe(true);
    expect(invalidated(queryKeys.appointment.one("a1"))).toBe(true);
  });

  it("reschedule invalidates the day list, the appointment and slots", async () => {
    const { result } = await renderHook(() => useRescheduleAppointment(), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: "a1", start: "2026-11-03T11:00:00+05:00" });
    });
    expect(invalidated(queryKeys.appointments.range(DAY, DAY))).toBe(true);
    expect(invalidated(queryKeys.appointment.one("a1"))).toBe(true);
    expect(invalidated(queryKeys.slots.one("s1", DAY))).toBe(true);
  });
});
