import { describe, expect, it, vi } from "vitest";

import { createApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { rescheduleAppointment, rescheduleErrorKind } from "./reschedule";

function problem(status: number, code?: string) {
  return async () =>
    new Response(code ? JSON.stringify({ code }) : null, {
      status,
      headers: { "Content-Type": "application/problem+json" },
    });
}

function setup(respond: () => Promise<Response>) {
  const fetch = vi.fn<(input: Request) => Promise<Response>>(respond);
  const api = createApi({
    baseUrl: "https://api.test",
    getAccessToken: async () => "tok",
    onUnauthorized: vi.fn(),
    fetch,
  });
  return { fetch, api };
}

async function errorOf(status: number, code?: string): Promise<unknown> {
  const { api } = setup(problem(status, code));
  try {
    await rescheduleAppointment(api, "a1", new Date("2026-11-03T05:00:00Z"));
  } catch (e) {
    return e;
  }
  throw new Error("expected failure");
}

describe("rescheduleAppointment", () => {
  it("posts the new start as ISO", async () => {
    const { fetch, api } = setup(async () => new Response("{}", { status: 200 }));
    await rescheduleAppointment(api, "a1", new Date("2026-11-03T05:00:00Z"));
    const request = fetch.mock.calls[0]?.[0];
    expect(request?.method).toBe("POST");
    expect(request?.url).toBe("https://api.test/appointments/a1/reschedule");
    expect(await request?.text()).toBe('{"start":"2026-11-03T05:00:00.000Z"}');
  });
});

describe("rescheduleErrorKind", () => {
  it("maps TIME_TAKEN to taken", async () => {
    expect(rescheduleErrorKind(await errorOf(409, "TIME_TAKEN"))).toBe("taken");
  });
  it("maps a 409 without a known code to taken", async () => {
    expect(rescheduleErrorKind(await errorOf(409))).toBe("taken");
  });
  it("maps NOT_CONFIRMED to gone", async () => {
    expect(rescheduleErrorKind(await errorOf(409, "NOT_CONFIRMED"))).toBe("gone");
  });
  it("maps 404 to gone", async () => {
    expect(rescheduleErrorKind(await errorOf(404, "APPOINTMENT_NOT_FOUND"))).toBe("gone");
  });
  it("maps OUTSIDE_SCHEDULE to outside", async () => {
    expect(rescheduleErrorKind(await errorOf(422, "OUTSIDE_SCHEDULE"))).toBe("outside");
  });
  it("maps a network error to offline", () => {
    expect(rescheduleErrorKind(new ApiError("network"))).toBe("offline");
  });
  it("maps 500 and unknown errors to failed", async () => {
    expect(rescheduleErrorKind(await errorOf(500))).toBe("failed");
    expect(rescheduleErrorKind(new Error("boom"))).toBe("failed");
  });
});
