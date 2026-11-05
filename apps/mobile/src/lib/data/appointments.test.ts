import { describe, expect, it, jest } from "@jest/globals";

import { createApi } from "@/lib/api/client";

import type { AppointmentListItem } from "./appointments";
import { fetchAppointments, toAppointment } from "./appointments";

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

describe("toAppointment", () => {
  it("turns times into Dates", () => {
    const a = toAppointment(item);
    expect(a.start.toISOString()).toBe("2026-11-03T05:00:00.000Z");
    expect(a.end.toISOString()).toBe("2026-11-03T06:00:00.000Z");
    expect(a.clientName).toBe("Анна");
  });

  it("falls back to the phone when the client has no name", () => {
    expect(toAppointment({ ...item, clientName: null }).clientName).toBe("+998901234567");
  });
});

describe("fetchAppointments", () => {
  it("calls GET /appointments with the local days", async () => {
    const fetch = jest.fn<(input: Request) => Promise<Response>>(
      async () => new Response(JSON.stringify([item]), { status: 200 }),
    );
    const api = createApi({
      baseUrl: "https://api.test",
      getAccessToken: async () => "tok",
      onUnauthorized: jest.fn(),
      fetch,
    });
    const data = await fetchAppointments(api, "2026-11-03", "2026-11-03");
    expect(fetch.mock.calls[0]?.[0].url).toBe(
      "https://api.test/appointments?from=2026-11-03&to=2026-11-03",
    );
    expect(data).toEqual([item]);
  });
});
