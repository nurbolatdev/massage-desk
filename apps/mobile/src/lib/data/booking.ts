import type { components } from "@massage-desk/api-types";

import type { createApi } from "@/lib/api/client";
import { unwrap } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";

import type { AppointmentResponse } from "./appointmentActions";

type Api = ReturnType<typeof createApi>;

export type ServiceResponse = components["schemas"]["ServiceResponse"];
export type SlotsResponse = components["schemas"]["SlotsResponse"];
export type ClientResponse = components["schemas"]["ClientResponse"];

export const CLIENT_SEARCH_LIMIT = 5;

/** `phone` is already E.164. */
export type ClientChoice = { kind: "existing"; id: string } | { kind: "new"; phone: string; name: string };

export function fetchServices(api: Api): Promise<ServiceResponse[]> {
  return unwrap(api.GET("/services"));
}

export function fetchSlots(api: Api, serviceId: string, day: string): Promise<SlotsResponse> {
  return unwrap(api.GET("/slots", { params: { query: { serviceId, day } } }));
}

export function searchClients(api: Api, q: string): Promise<ClientResponse[]> {
  return unwrap(api.GET("/clients", { params: { query: { q, limit: CLIENT_SEARCH_LIMIT } } }));
}

/** Returns the client id; a new client is created first, or found if the phone is taken. */
export async function resolveClientId(api: Api, choice: ClientChoice): Promise<string> {
  if (choice.kind === "existing") return choice.id;
  try {
    const created = await unwrap(api.POST("/clients", { body: { phone: choice.phone, name: choice.name } }));
    return created.id;
  } catch (e) {
    if (e instanceof ApiError && e.code === "PHONE_TAKEN") {
      const found = (await searchClients(api, choice.phone)).find((c) => c.phone === choice.phone);
      if (found) return found.id;
    }
    throw e;
  }
}

export interface BookInput {
  client: ClientChoice;
  serviceId: string;
  start: string;
}

export async function bookAppointment(
  api: Api,
  { client, serviceId, start }: BookInput,
): Promise<{ appointment: AppointmentResponse; clientId: string }> {
  const clientId = await resolveClientId(api, client);
  const appointment = await unwrap(api.POST("/appointments", { body: { clientId, serviceId, start } }));
  return { appointment, clientId };
}
