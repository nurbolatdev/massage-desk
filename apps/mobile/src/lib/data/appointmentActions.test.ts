import { describe, expect, it, jest } from "@jest/globals";

import { createApi } from "@/lib/api/client";

import { postAppointmentAction, rescheduleAppointment, withStatus } from "./appointmentActions";
import type { AppointmentListItem } from "./appointments";

const response = {
  id: "a1",
  clientId: "c1",
  serviceId: "s1",
  start: "2026-11-03T10:00:00+05:00",
  end: "2026-11-03T11:00:00+05:00",
  status: "cancelled",
  source: "bot",
};

function setup() {
  const fetch = jest.fn<(input: Request) => Promise<Response>>(
    async () => new Response(JSON.stringify(response), { status: 200 }),
  );
  const api = createApi({
    baseUrl: "https://api.test",
    getAccessToken: async () => "tok",
    onUnauthorized: jest.fn(),
    fetch,
  });
  return { api, fetch };
}

describe("postAppointmentAction", () => {
  it("sends POST /appointments/{id}/cancel for cancel", async () => {
    const { api, fetch } = setup();
    const result = await postAppointmentAction(api, "a1", "cancel");
    expect(fetch.mock.calls[0]?.[0].method).toBe("POST");
    expect(fetch.mock.calls[0]?.[0].url).toBe("https://api.test/appointments/a1/cancel");
    expect(result).toEqual(response);
  });

  it("sends POST /appointments/{id}/no-show for noShow", async () => {
    const { api, fetch } = setup();
    const result = await postAppointmentAction(api, "a1", "noShow");
    expect(fetch.mock.calls[0]?.[0].method).toBe("POST");
    expect(fetch.mock.calls[0]?.[0].url).toBe("https://api.test/appointments/a1/no-show");
    expect(result).toEqual(response);
  });
});

describe("rescheduleAppointment", () => {
  it("sends POST /appointments/{id}/reschedule with the new start", async () => {
    const { api, fetch } = setup();
    const start = "2026-11-04T11:30:00+05:00";
    const result = await rescheduleAppointment(api, "a1", start);
    const request = fetch.mock.calls[0]?.[0];
    expect(request?.method).toBe("POST");
    expect(request?.url).toBe("https://api.test/appointments/a1/reschedule");
    expect(await request?.json()).toEqual({ start });
    expect(result).toEqual(response);
  });

  it("rejects with ApiError carrying the code", async () => {
    const { api, fetch } = setup();
    fetch.mockImplementation(
      async () =>
        new Response(JSON.stringify({ code: "TIME_TAKEN", message: "taken" }), { status: 409 }),
    );
    await expect(rescheduleAppointment(api, "a1", "2026-11-04T11:30:00+05:00")).rejects.toMatchObject(
      { status: 409, code: "TIME_TAKEN" },
    );
  });
});

const item = (id: string): AppointmentListItem => ({
  id,
  clientId: "c1",
  clientName: "Анна",
  clientPhone: "+998901234567",
  serviceId: "s1",
  serviceName: "Классический массаж",
  start: "2026-11-03T10:00:00+05:00",
  end: "2026-11-03T11:00:00+05:00",
  status: "confirmed",
  source: "bot",
});

describe("withStatus", () => {
  it("changes only the item with that id", () => {
    const a = item("a1");
    const b = item("a2");
    const result = withStatus([a, b], "a1", "cancelled");
    expect(result?.[0]).toEqual({ ...a, status: "cancelled" });
    expect(result?.[1]).toBe(b);
  });

  it("keeps undefined as undefined", () => {
    expect(withStatus(undefined, "a1", "cancelled")).toBeUndefined();
  });
});
