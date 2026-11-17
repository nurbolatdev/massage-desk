// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApi, unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { useServices } from "./hooks";

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
