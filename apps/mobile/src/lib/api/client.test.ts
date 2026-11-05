import { describe, expect, it, jest } from "@jest/globals";

import { createApi, unwrap } from "./client";
import { ApiError } from "./errors";

function setup(options: { token?: string | null; respond?: () => Response | Promise<Response> }) {
  const token = options.token === undefined ? "tok" : options.token;
  const fetch = jest.fn<(input: Request) => Promise<Response>>(async () =>
    options.respond ? options.respond() : new Response("[]", { status: 200 }),
  );
  const onUnauthorized = jest.fn();
  const api = createApi({
    baseUrl: "https://api.test",
    getAccessToken: async () => token,
    onUnauthorized,
    fetch,
  });
  const list = () =>
    api.GET("/appointments", { params: { query: { from: "2026-11-03", to: "2026-11-04" } } });
  return { fetch, onUnauthorized, list };
}

async function kindOf(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (e) {
    if (e instanceof ApiError) return e;
  }
  throw new Error("expected ApiError");
}

describe("createApi", () => {
  it("sends the bearer token to baseUrl + path + query", async () => {
    const { fetch, list } = setup({});
    await unwrap(list());
    const request = fetch.mock.calls[0]?.[0];
    expect(request?.url).toBe("https://api.test/appointments?from=2026-11-03&to=2026-11-04");
    expect(request?.headers.get("Authorization")).toBe("Bearer tok");
  });

  it("does not call fetch without a token", async () => {
    const { fetch, list } = setup({ token: null });
    expect((await kindOf(unwrap(list()))).kind).toBe("network");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("maps a thrown fetch to network", async () => {
    const { list } = setup({
      respond: () => {
        throw new TypeError("Network request failed");
      },
    });
    expect((await kindOf(unwrap(list()))).kind).toBe("network");
  });

  it("calls onUnauthorized once on 401", async () => {
    const { onUnauthorized, list } = setup({ respond: () => new Response(null, { status: 401 }) });
    expect((await kindOf(unwrap(list()))).kind).toBe("unauthorized");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("maps an empty 403 to forbidden", async () => {
    const { onUnauthorized, list } = setup({ respond: () => new Response(null, { status: 403 }) });
    expect((await kindOf(unwrap(list()))).kind).toBe("forbidden");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("maps a problem body to its code", async () => {
    const { list } = setup({
      respond: () =>
        new Response(JSON.stringify({ code: "CLIENT_NOT_FOUND" }), {
          status: 404,
          headers: { "Content-Type": "application/problem+json" },
        }),
    });
    const error = await kindOf(unwrap(list()));
    expect(error.kind).toBe("problem");
    expect(error.code).toBe("CLIENT_NOT_FOUND");
  });

  it("maps a 500 HTML body to server", async () => {
    const { list } = setup({
      respond: () => new Response("<html>oops</html>", { status: 500 }),
    });
    expect((await kindOf(unwrap(list()))).kind).toBe("server");
  });

  it("returns typed data on 200", async () => {
    const { list } = setup({
      respond: () =>
        new Response(JSON.stringify([{ id: 1, clientName: null }]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });
    const data = await unwrap(list());
    expect(data[0]?.clientName).toBeNull();
  });
});
