import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ApiError } from "@/lib/api/errors";

import { useAppointment } from "./hooks";
import { queryKeys } from "./queryKeys";

type Call = (path: string, init?: unknown) => Promise<unknown>;

const mockGet = jest.fn<Call>();

jest.mock("@/lib/api", () => ({
  api: { GET: (path: string, init?: unknown) => mockGet(path, init) },
  unwrap: jest.requireActual<typeof import("@/lib/api/client")>("@/lib/api/client").unwrap,
  ApiError: jest.requireActual<typeof import("@/lib/api/errors")>("@/lib/api/errors").ApiError,
}));

function ok(data: unknown) {
  return { data, response: new Response(null, { status: 200 }) };
}

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: Infinity } },
});

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function callsTo(path: string) {
  return mockGet.mock.calls.filter(([called]) => called === path);
}

async function refetchAfterSettingsError(day: string | undefined) {
  const { result } = await renderHook(() => useAppointment("a1", day), { wrapper });
  await waitFor(() => expect(callsTo("/settings")).toHaveLength(1));
  await act(async () => {
    result.current.refetch();
  });
  await waitFor(() => expect(callsTo("/settings")).toHaveLength(2));
}

describe("useAppointment refetch", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockGet.mockImplementation(async (path) => {
      if (path === "/settings") throw new ApiError("server", { status: 500 });
      if (path === "/appointments") return ok([]);
      throw new Error(`unexpected GET ${path}`);
    });
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("does not ask for appointments when there is no day", async () => {
    await refetchAfterSettingsError(undefined);
    expect(callsTo("/appointments")).toHaveLength(0);
  });

  it("does not ask for appointments when the day is invalid", async () => {
    await refetchAfterSettingsError("2026-13-40");
    expect(callsTo("/appointments")).toHaveLength(0);
  });

  it("asks for appointments of that day only when the day is valid", async () => {
    await refetchAfterSettingsError("2026-11-03");
    await waitFor(() => expect(callsTo("/appointments")).toHaveLength(2));
    for (const [, init] of callsTo("/appointments")) {
      expect(init).toEqual({ params: { query: { from: "2026-11-03", to: "2026-11-03" } } });
    }
  });
});

describe("useAppointment errors", () => {
  const DAY = "2026-11-03";
  const settings = { timeZone: "Asia/Tashkent", botEnabled: true, address: null };

  function mockPaths(handlers: { settings: Call; appointments: Call }) {
    mockGet.mockImplementation(async (path, init) => {
      if (path === "/settings") return handlers.settings(path, init);
      if (path === "/appointments") return handlers.appointments(path, init);
      throw new Error(`unexpected GET ${path}`);
    });
  }

  /** First call succeeds, the following ones fail. */
  function okThenFail(data: unknown): Call {
    let calls = 0;
    return async () => {
      calls += 1;
      if (calls === 1) return ok(data);
      throw new ApiError("server", { status: 500 });
    };
  }

  const alwaysFail: Call = async () => {
    throw new ApiError("server", { status: 500 });
  };

  beforeEach(() => {
    mockGet.mockReset();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("a failed settings refresh with data shown is not a refresh error", async () => {
    mockPaths({ settings: okThenFail(settings), appointments: async () => ok([]) });
    const { result } = await renderHook(() => useAppointment("a1", DAY), { wrapper });
    await waitFor(() => expect(result.current.hasData).toBe(true));

    await act(async () => {
      result.current.refetch();
    });
    await waitFor(() => expect(queryClient.getQueryState(queryKeys.settings)?.status).toBe("error"));

    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));
    expect(result.current.hasData).toBe(true);
    expect(result.current.refreshError).toBeNull();
  });

  it("a failed list refresh is a refresh error", async () => {
    mockPaths({ settings: async () => ok(settings), appointments: okThenFail([]) });
    const { result } = await renderHook(() => useAppointment("a1", DAY), { wrapper });
    await waitFor(() => expect(result.current.hasData).toBe(true));

    await act(async () => {
      result.current.refetch();
    });
    await waitFor(() => expect(queryClient.getQueryState(queryKeys.appointments.range(DAY, DAY))?.status).toBe("error"));

    await waitFor(() => expect(result.current.refreshError).toBeInstanceOf(ApiError));
    expect(result.current.hasData).toBe(true);
    expect(result.current.error).toBe(result.current.refreshError);
  });

  it("a settings failure before any data is the error, not a refresh error", async () => {
    mockPaths({ settings: alwaysFail, appointments: async () => ok([]) });
    const { result } = await renderHook(() => useAppointment("a1", DAY), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.hasData).toBe(false);
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.refreshError).toBeNull();
  });
});
