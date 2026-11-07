import { describe, expect, it, jest } from "@jest/globals";

import { createApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import { bookAppointment, fetchSlots, searchClients } from "./booking";

const START = "2026-11-03T15:00:00+05:00";
const PHONE = "+998901234567";
const appointment = {
  id: "a1",
  clientId: "c1",
  serviceId: "s1",
  start: START,
  end: "2026-11-03T16:00:00+05:00",
  status: "confirmed",
  source: "manual",
};
const client = { id: "c1", name: "Айгуль", notes: null, phone: PHONE, createdAt: START };

type Reply = { status: number; body: unknown };

function setup(routes: Record<string, Reply>) {
  const fetch = jest.fn<(input: Request) => Promise<Response>>(async (request) => {
    const url = new URL(request.url);
    const reply = routes[`${request.method} ${url.pathname}`];
    if (!reply) throw new Error(`unexpected ${request.method} ${request.url}`);
    return new Response(JSON.stringify(reply.body), {
      status: reply.status,
      headers: { "Content-Type": "application/json" },
    });
  });
  const api = createApi({
    baseUrl: "https://api.test",
    getAccessToken: async () => "tok",
    onUnauthorized: jest.fn(),
    fetch,
  });
  const sent = () => fetch.mock.calls.map(([r]) => `${r.method} ${r.url}`);
  const bodyOf = async (index: number) => fetch.mock.calls[index]?.[0].clone().json();
  return { api, sent, bodyOf };
}

describe("fetchSlots", () => {
  it("sends GET /slots with serviceId and day", async () => {
    const { api, sent } = setup({
      "GET /slots": { status: 200, body: { day: "2026-11-03", timeZone: "Asia/Tashkent", durationMin: 60, starts: [START] } },
    });
    const result = await fetchSlots(api, "s1", "2026-11-03");
    expect(sent()).toEqual(["GET https://api.test/slots?serviceId=s1&day=2026-11-03"]);
    expect(result.starts).toEqual([START]);
  });
});

describe("searchClients", () => {
  it("sends q and limit=5", async () => {
    const { api, sent } = setup({ "GET /clients": { status: 200, body: [client] } });
    await searchClients(api, "901");
    expect(sent()).toEqual(["GET https://api.test/clients?q=901&limit=5"]);
  });
});

describe("bookAppointment", () => {
  it("sends one POST /appointments for an existing client", async () => {
    const { api, sent, bodyOf } = setup({ "POST /appointments": { status: 201, body: appointment } });
    const result = await bookAppointment(api, {
      client: { kind: "existing", id: "c1", name: "Айгуль" },
      serviceId: "s1",
      start: START,
    });
    expect(sent()).toEqual(["POST https://api.test/appointments"]);
    expect(await bodyOf(0)).toEqual({ clientId: "c1", serviceId: "s1", start: START });
    expect(result).toEqual({ appointment, clientId: "c1", clientName: "Айгуль" });
  });

  it("creates a new client first and books with the new id", async () => {
    const { api, sent, bodyOf } = setup({
      "POST /clients": { status: 201, body: client },
      "POST /appointments": { status: 201, body: appointment },
    });
    await bookAppointment(api, {
      client: { kind: "new", phone: PHONE, name: "Айгуль" },
      serviceId: "s1",
      start: START,
    });
    expect(sent()).toEqual(["POST https://api.test/clients", "POST https://api.test/appointments"]);
    expect(await bodyOf(0)).toEqual({ phone: PHONE, name: "Айгуль" });
    expect(await bodyOf(1)).toEqual({ clientId: "c1", serviceId: "s1", start: START });
  });

  it("finds the client by phone when the phone is taken", async () => {
    const { api, sent, bodyOf } = setup({
      "POST /clients": { status: 409, body: { code: "PHONE_TAKEN" } },
      "GET /clients": { status: 200, body: [{ ...client, id: "other", phone: "+998909999999" }, client] },
      "POST /appointments": { status: 201, body: appointment },
    });
    await bookAppointment(api, {
      client: { kind: "new", phone: PHONE, name: "Айгуль" },
      serviceId: "s1",
      start: START,
    });
    expect(sent()).toEqual([
      "POST https://api.test/clients",
      "GET https://api.test/clients?q=%2B998901234567&limit=5",
      "POST https://api.test/appointments",
    ]);
    expect(await bodyOf(2)).toEqual({ clientId: "c1", serviceId: "s1", start: START });
  });

  it("returns the name of the client found by phone, not the typed one", async () => {
    const { api } = setup({
      "POST /clients": { status: 409, body: { code: "PHONE_TAKEN" } },
      "GET /clients": { status: 200, body: [{ ...client, name: "Гульнара" }] },
      "POST /appointments": { status: 201, body: appointment },
    });
    const result = await bookAppointment(api, {
      client: { kind: "new", phone: PHONE, name: "Айгуль" },
      serviceId: "s1",
      start: START,
    });
    expect(result.clientName).toBe("Гульнара");
  });

  it("returns the name of a created client", async () => {
    const { api } = setup({
      "POST /clients": { status: 201, body: { ...client, name: "Айгуль Сапарова" } },
      "POST /appointments": { status: 201, body: appointment },
    });
    const result = await bookAppointment(api, {
      client: { kind: "new", phone: PHONE, name: "Айгуль" },
      serviceId: "s1",
      start: START,
    });
    expect(result.clientName).toBe("Айгуль Сапарова");
  });

  it("falls back to the phone when the client has no name", async () => {
    const { api } = setup({
      "POST /clients": { status: 409, body: { code: "PHONE_TAKEN" } },
      "GET /clients": { status: 200, body: [{ ...client, name: null }] },
      "POST /appointments": { status: 201, body: appointment },
    });
    const result = await bookAppointment(api, {
      client: { kind: "new", phone: PHONE, name: "Айгуль" },
      serviceId: "s1",
      start: START,
    });
    expect(result.clientName).toBe(PHONE);
  });

  it("rejects with PHONE_TAKEN when no client matches the phone exactly", async () => {
    const { api } = setup({
      "POST /clients": { status: 409, body: { code: "PHONE_TAKEN" } },
      "GET /clients": { status: 200, body: [{ ...client, id: "other", phone: "+998909999999" }] },
    });
    const error = await bookAppointment(api, {
      client: { kind: "new", phone: PHONE, name: "Айгуль" },
      serviceId: "s1",
      start: START,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("PHONE_TAKEN");
  });

  it("rejects with TIME_TAKEN when the time is taken", async () => {
    const { api } = setup({ "POST /appointments": { status: 409, body: { code: "TIME_TAKEN" } } });
    const error = await bookAppointment(api, {
      client: { kind: "existing", id: "c1", name: "Айгуль" },
      serviceId: "s1",
      start: START,
    }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "TIME_TAKEN" });
  });
});
