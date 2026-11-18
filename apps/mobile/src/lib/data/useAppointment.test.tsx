import { afterEach, beforeEach, describe, expect, it, jest } from "@jest/globals";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ApiError } from "@/lib/api/errors";
import { shouldRetry } from "@/lib/query/queryClient";

import type { AppointmentListItem } from "./appointments";
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

const item: AppointmentListItem = {
  id: "a1",
  clientId: "c1",
  clientName: "Анна",
  clientPhone: "+998901234567",
  serviceId: "s1",
  serviceName: "Классический массаж",
  start: "2026-11-03T10:00:00+05:00",
  end: "2026-11-03T11:00:00+05:00",
  status: "confirmed",
  source: "bot",
};

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
      if (path === "/appointments") return ok([item]);
      if (path === "/appointments/{id}") return ok(item);
      throw new Error(`unexpected GET ${path}`);
    });
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("asks for the appointment by id, not the list, when there is no day", async () => {
    await refetchAfterSettingsError(undefined);
    await waitFor(() => expect(callsTo("/appointments/{id}")).toHaveLength(2));
    expect(callsTo("/appointments")).toHaveLength(0);
    expect(callsTo("/appointments/{id}")[0]?.[1]).toEqual({ params: { path: { id: "a1" } } });
  });

  it("asks for the appointment by id, not the list, when the day is invalid", async () => {
    await refetchAfterSettingsError("2026-13-40");
    await waitFor(() => expect(callsTo("/appointments/{id}")).toHaveLength(2));
    expect(callsTo("/appointments")).toHaveLength(0);
    expect(callsTo("/appointments/{id}")[0]?.[1]).toEqual({ params: { path: { id: "a1" } } });
  });

  it("asks for appointments of that day only when the day is valid", async () => {
    await refetchAfterSettingsError("2026-11-03");
    await waitFor(() => expect(callsTo("/appointments")).toHaveLength(2));
    for (const [, init] of callsTo("/appointments")) {
      expect(init).toEqual({ params: { query: { from: "2026-11-03", to: "2026-11-03" } } });
    }
    expect(callsTo("/appointments/{id}")).toHaveLength(0);
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
    mockPaths({ settings: okThenFail(settings), appointments: async () => ok([item]) });
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
    mockPaths({ settings: async () => ok(settings), appointments: okThenFail([item]) });
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
    mockPaths({ settings: alwaysFail, appointments: async () => ok([item]) });
    const { result } = await renderHook(() => useAppointment("a1", DAY), { wrapper });
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.hasData).toBe(false);
    expect(result.current.error).toBeInstanceOf(ApiError);
    expect(result.current.refreshError).toBeNull();
  });
});

describe("useAppointment by id", () => {
  const DAY = "2026-11-03";
  const settings = { timeZone: "Asia/Tashkent", botEnabled: true, address: null };

  function problem(status: number, code: string) {
    return {
      error: { code, status, title: "Error", detail: "", instance: "/appointments/a1" },
      response: new Response(null, { status }),
    };
  }

  function mockPaths(one: Call, list: Call = async () => ok([])) {
    mockGet.mockImplementation(async (path, init) => {
      if (path === "/settings") return ok(settings);
      if (path === "/appointments") return list(path, init);
      if (path === "/appointments/{id}") return one(path, init);
      throw new Error(`unexpected GET ${path}`);
    });
  }

  const notFound: Call = async () => {
    throw new ApiError("problem", { status: 404, code: "APPOINTMENT_NOT_FOUND" });
  };

  beforeEach(() => {
    mockGet.mockReset();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("loads the appointment without a day", async () => {
    mockPaths(async () => ok(item));
    const { result } = await renderHook(() => useAppointment("a1", undefined), { wrapper });
    await waitFor(() => expect(result.current.hasData).toBe(true));

    expect(result.current.appointment?.id).toBe("a1");
    expect(result.current.notFound).toBe(false);
    expect(queryClient.getQueryData(queryKeys.appointment.one("a1"))).toEqual(item);
  });

  it("an unknown id without a day is not found, without retries", async () => {
    mockPaths(notFound);
    const retryingClient = new QueryClient({
      defaultOptions: { queries: { retry: shouldRetry, gcTime: Infinity } },
    });
    const retryingWrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={retryingClient}>{children}</QueryClientProvider>
    );
    const { result } = await renderHook(() => useAppointment("a1", undefined), {
      wrapper: retryingWrapper,
    });
    await waitFor(() => expect(result.current.notFound).toBe(true));

    expect(result.current.error).toBeNull();
    expect(result.current.refreshError).toBeNull();
    expect(callsTo("/appointments/{id}")).toHaveLength(1);
    retryingClient.clear();
  });

  it("finds an appointment that the day's list does not have", async () => {
    mockPaths(async () => ok(item));
    const { result } = await renderHook(() => useAppointment("a1", DAY), { wrapper });
    await waitFor(() => expect(result.current.appointment?.id).toBe("a1"));

    expect(result.current.notFound).toBe(false);
    expect(callsTo("/appointments/{id}")).toHaveLength(1);
  });

  it("is not found when neither the day's list nor the id has it", async () => {
    mockPaths(notFound);
    const { result } = await renderHook(() => useAppointment("a1", DAY), { wrapper });
    await waitFor(() => expect(result.current.notFound).toBe(true));

    expect(result.current.appointment).toBeUndefined();
  });

  it("a server failure by id is an error, not not-found", async () => {
    mockPaths(async () => {
      throw new ApiError("server", { status: 500 });
    });
    const { result } = await renderHook(() => useAppointment("a1", undefined), { wrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));

    expect(result.current.notFound).toBe(false);
    expect(result.current.hasData).toBe(false);
  });

  it("an empty id is not found and asks for nothing", async () => {
    mockPaths(async () => ok(item));
    const { result } = await renderHook(() => useAppointment("", undefined), { wrapper });

    expect(result.current.notFound).toBe(true);
    await waitFor(() => expect(callsTo("/settings")).toHaveLength(1));
    expect(callsTo("/appointments/{id}")).toHaveLength(0);
  });

  it("ignores an error body shape other than not-found", async () => {
    mockPaths(async () => problem(404, "OTHER"));
    const { result } = await renderHook(() => useAppointment("a1", undefined), { wrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(ApiError));

    expect(result.current.notFound).toBe(false);
  });
});
