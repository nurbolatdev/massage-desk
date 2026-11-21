// @vitest-environment jsdom
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";

import { useRescheduleAppointment } from "./hooks";
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

beforeEach(() => {
  respond.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("useRescheduleAppointment", () => {
  it("reports the error only after the appointments list was refetched", async () => {
    respond.mockResolvedValue(
      new Response(JSON.stringify({ status: 409, code: "NOT_CONFIRMED" }), {
        status: 409,
        headers: { "Content-Type": "application/problem+json" },
      }),
    );

    let release: (value: string[]) => void = () => {};
    let calls = 0;
    const queryFn = () => {
      calls += 1;
      if (calls === 1) return Promise.resolve(["before"]);
      return new Promise<string[]>((resolve) => {
        release = resolve;
      });
    };

    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(
      () => ({
        list: useQuery({ queryKey: queryKeys.appointments.range("a", "b"), queryFn }),
        move: useRescheduleAppointment(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    act(() => {
      result.current.move.mutate({ id: "a1", start: new Date("2026-11-03T10:00:00Z") });
    });
    await waitFor(() => expect(calls).toBe(2));
    expect(result.current.move.isError).toBe(false);

    await act(async () => {
      release(["after"]);
    });
    await waitFor(() => expect(result.current.move.isError).toBe(true));
    expect(result.current.list.data).toEqual(["after"]);
  });
});
