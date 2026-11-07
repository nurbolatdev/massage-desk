import { ApiError } from "@/lib/api/errors";

import type { ClientResponse } from "./booking";
import { BOOK_FAILED, NOT_FOUND_BOOKING_TEXT, OUTSIDE_TEXT } from "./newBooking";

export const INVALID_PHONE_TEXT = "Проверьте номер. Например: +998 90 123 45 67";

export type BookingErrorKind = "taken" | "outside" | "notFound" | "invalidPhone" | "failed";

export function bookingErrorKind(error: unknown): BookingErrorKind {
  if (!(error instanceof ApiError)) return "failed";
  if (error.code === "OUTSIDE_SCHEDULE") return "outside";
  if (error.code === "INVALID_PHONE") return "invalidPhone";
  if (error.code === "TIME_TAKEN") return "taken";
  if (error.status === 409 && error.code !== "PHONE_TAKEN") return "taken";
  if (error.status === 404) return "notFound";
  return "failed";
}

/** The «taken» kind has no text here: the conflict alert renders it. */
export function bookingErrorText(kind: BookingErrorKind): string | null {
  switch (kind) {
    case "taken":
      return null;
    case "outside":
      return OUTSIDE_TEXT;
    case "notFound":
      return NOT_FOUND_BOOKING_TEXT;
    case "invalidPhone":
      return INVALID_PHONE_TEXT;
    case "failed":
      return BOOK_FAILED;
  }
}

export type BookingForm = {
  phoneText: string;
  clientId: string | null;
  clientLabel: string | null;
  newClient: boolean;
  name: string;
  serviceId: string | null;
  /** null means today. */
  day: string | null;
  start: string | null;
  taken: string | null;
  collapsed: boolean;
  error: BookingErrorKind | null;
};

export function initialForm(serviceId: string | null): BookingForm {
  return {
    phoneText: "",
    clientId: null,
    clientLabel: null,
    newClient: false,
    name: "",
    serviceId,
    day: null,
    start: null,
    taken: null,
    collapsed: false,
    error: null,
  };
}

export type BookingAction =
  | { type: "phoneChanged"; text: string }
  | { type: "clientPicked"; client: ClientResponse }
  | { type: "newClientChosen" }
  | { type: "nameChanged"; name: string }
  | { type: "servicePicked"; id: string }
  | { type: "dayPicked"; day: string }
  | { type: "timePicked"; start: string }
  | { type: "bookFailed"; kind: BookingErrorKind }
  | { type: "expanded" };

export function bookingFormReducer(state: BookingForm, action: BookingAction): BookingForm {
  switch (action.type) {
    case "phoneChanged":
      if (action.text === state.phoneText && state.clientId === null && !state.newClient && state.error === null) {
        return state;
      }
      return { ...state, phoneText: action.text, clientId: null, clientLabel: null, newClient: false, error: null };
    case "clientPicked":
      return {
        ...state,
        clientId: action.client.id,
        clientLabel: action.client.name ?? action.client.phone,
        newClient: false,
      };
    case "newClientChosen":
      return state.newClient ? state : { ...state, newClient: true };
    case "nameChanged":
      return action.name === state.name ? state : { ...state, name: action.name };
    case "servicePicked":
      return { ...state, serviceId: action.id, start: null, taken: null, error: null };
    case "dayPicked":
      return { ...state, day: action.day, start: null, taken: null, error: null };
    case "timePicked":
      if (action.start === state.taken) return state;
      if (action.start === state.start && state.taken === null && state.error === null) return state;
      return { ...state, start: action.start, taken: null, error: null };
    case "bookFailed":
      if (action.kind === "taken") {
        return { ...state, taken: state.start, start: null, collapsed: true, error: action.kind };
      }
      if (action.kind === "outside") {
        return { ...state, taken: state.start, start: null, error: action.kind };
      }
      return { ...state, error: action.kind };
    case "expanded":
      return state.collapsed ? { ...state, collapsed: false } : state;
  }
}
