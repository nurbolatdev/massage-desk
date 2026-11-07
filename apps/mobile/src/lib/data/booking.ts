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

/** `phone` is already E.164; `name` of an existing client is the label shown in the picker. */
export type ClientChoice = { kind: "existing"; id: string; name: string } | { kind: "new"; phone: string; name: string };

export function fetchServices(api: Api): Promise<ServiceResponse[]> {
  return unwrap(api.GET("/services"));
}

export function fetchSlots(api: Api, serviceId: string, day: string): Promise<SlotsResponse> {
  return unwrap(api.GET("/slots", { params: { query: { serviceId, day } } }));
}

export function searchClients(api: Api, q: string): Promise<ClientResponse[]> {
  return unwrap(api.GET("/clients", { params: { query: { q, limit: CLIENT_SEARCH_LIMIT } } }));
}

function clientName(client: ClientResponse): string {
  return client.name ?? client.phone;
}

/** Returns the client to book: a new one is created first, or found if the phone is taken. */
export async function resolveClient(api: Api, choice: ClientChoice): Promise<{ id: string; name: string }> {
  if (choice.kind === "existing") return { id: choice.id, name: choice.name };
  try {
    const created = await unwrap(api.POST("/clients", { body: { phone: choice.phone, name: choice.name } }));
    return { id: created.id, name: clientName(created) };
  } catch (e) {
    if (e instanceof ApiError && e.code === "PHONE_TAKEN") {
      const found = (await searchClients(api, choice.phone)).find((c) => c.phone === choice.phone);
      if (found) return { id: found.id, name: clientName(found) };
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
): Promise<{ appointment: AppointmentResponse; clientId: string; clientName: string }> {
  const resolved = await resolveClient(api, client);
  const appointment = await unwrap(api.POST("/appointments", { body: { clientId: resolved.id, serviceId, start } }));
  return { appointment, clientId: resolved.id, clientName: resolved.name };
}
