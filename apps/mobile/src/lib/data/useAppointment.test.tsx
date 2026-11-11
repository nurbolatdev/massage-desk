import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ApiError } from "@/lib/api/errors";

import { useAppointment } from "./hooks";

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
