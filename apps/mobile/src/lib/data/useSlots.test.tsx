import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { useSlots } from "./hooks";
import { queryKeys } from "./queryKeys";

type Call = (path: string, init?: unknown) => Promise<unknown>;

const mockGet = jest.fn<Call>();

jest.mock("@/lib/api", () => ({
  api: { GET: (path: string, init?: unknown) => mockGet(path, init) },
  unwrap: jest.requireActual<typeof import("@/lib/api/client")>("@/lib/api/client").unwrap,
  ApiError: jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors").ApiError,
}));

const DAY = "2026-11-03";

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useSlots", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockImplementation(async (_path, init) => {
      const query = (init as { params: { query: { excludeAppointmentId?: string } } }).params.query;
      const starts = query.excludeAppointmentId === undefined ? [`${DAY}T10:00:00+05:00`] : [`${DAY}T09:30:00+05:00`];
      return {
        data: { day: DAY, timeZone: "Asia/Tashkent", durationMin: 60, starts },
        response: new Response(null, { status: 200 }),
      };
    });
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("keeps the free times with and without the excluded appointment in separate cache entries", async () => {
    const { result } = await renderHook(() => ({ plain: useSlots("s1", DAY), excluding: useSlots("s1", DAY, "a1") }), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.plain.data).toBeDefined();
      expect(result.current.excluding.data).toBeDefined();
    });

    expect(result.current.plain.data?.starts).toEqual([`${DAY}T10:00:00+05:00`]);
    expect(result.current.excluding.data?.starts).toEqual([`${DAY}T09:30:00+05:00`]);
    expect(queryClient.getQueryData(queryKeys.slots.one("s1", DAY))).toBeDefined();
    expect(queryClient.getQueryData(queryKeys.slots.one("s1", DAY, "a1"))).toBeDefined();
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(mockGet).toHaveBeenCalledWith("/slots", { params: { query: { serviceId: "s1", day: DAY } } });
    expect(mockGet).toHaveBeenCalledWith("/slots", {
      params: { query: { serviceId: "s1", day: DAY, excludeAppointmentId: "a1" } },
    });
  });
});
