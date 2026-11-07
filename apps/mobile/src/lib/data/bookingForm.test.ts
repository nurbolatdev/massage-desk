import { describe, expect, it } from "@jest/globals";

import { ApiError } from "@/lib/api/errors";

import type { ClientResponse } from "./booking";
import { bookingErrorKind, bookingErrorText, bookingFormReducer, initialForm } from "./bookingForm";

const START = "2026-11-03T15:00:00+05:00";
const OTHER = "2026-11-03T16:00:00+05:00";

function withTime() {
  return bookingFormReducer(initialForm("s1"), { type: "timePicked", start: START });
}

describe("bookingFormReducer", () => {
  it("cannot pick the taken time again", () => {
    const failed = bookingFormReducer(withTime(), { type: "bookFailed", kind: "taken" });
    expect(failed.taken).toBe(START);
    expect(failed.start).toBeNull();
    expect(failed.collapsed).toBe(true);
    expect(bookingFormReducer(failed, { type: "timePicked", start: START })).toBe(failed);
  });

  it("clears taken and error when another time is picked", () => {
    const failed = bookingFormReducer(withTime(), { type: "bookFailed", kind: "taken" });
    const next = bookingFormReducer(failed, { type: "timePicked", start: OTHER });
    expect(next.start).toBe(OTHER);
    expect(next.taken).toBeNull();
    expect(next.error).toBeNull();
  });

  it("resets the time and the conflict on a new service or day", () => {
    const failed = bookingFormReducer(withTime(), { type: "bookFailed", kind: "taken" });
    for (const action of [
      { type: "servicePicked", id: "s2" },
      { type: "dayPicked", day: "2026-11-04" },
    ] as const) {
      const next = bookingFormReducer(failed, action);
      expect(next.start).toBeNull();
      expect(next.taken).toBeNull();
      expect(next.error).toBeNull();
    }
  });

  it("marks the time as taken when it is outside the schedule", () => {
    const next = bookingFormReducer(withTime(), { type: "bookFailed", kind: "outside" });
    expect(next.taken).toBe(START);
    expect(next.start).toBeNull();
    expect(next.collapsed).toBe(false);
  });

  it("keeps the time after a failed request", () => {
    const next = bookingFormReducer(withTime(), { type: "bookFailed", kind: "failed" });
    expect(next.start).toBe(START);
    expect(next.error).toBe("failed");
  });

  it("drops the picked client when the phone changes", () => {
    const client: ClientResponse = { id: "c1", phone: "+998901234567", name: "Айгуль" } as ClientResponse;
    const picked = bookingFormReducer(initialForm(null), { type: "clientPicked", client });
    expect(picked.clientId).toBe("c1");
    expect(picked.clientLabel).toBe("Айгуль");
    const next = bookingFormReducer(picked, { type: "phoneChanged", text: "90" });
    expect(next.clientId).toBeNull();
    expect(next.clientLabel).toBeNull();
  });

  it("expands the folded steps", () => {
    const failed = bookingFormReducer(withTime(), { type: "bookFailed", kind: "taken" });
    expect(bookingFormReducer(failed, { type: "expanded" }).collapsed).toBe(false);
  });
});

describe("bookingErrorKind", () => {
  it("maps API errors to kinds", () => {
    expect(bookingErrorKind(new ApiError("problem", { status: 409, code: "TIME_TAKEN" }))).toBe("taken");
    expect(bookingErrorKind(new ApiError("problem", { status: 409, code: "APPOINTMENT_CONFLICT" }))).toBe("taken");
    expect(bookingErrorKind(new ApiError("problem", { status: 409, code: "PHONE_TAKEN" }))).toBe("failed");
    expect(bookingErrorKind(new ApiError("problem", { status: 422, code: "OUTSIDE_SCHEDULE" }))).toBe("outside");
    expect(bookingErrorKind(new ApiError("problem", { status: 404, code: "CLIENT_NOT_FOUND" }))).toBe("notFound");
    expect(bookingErrorKind(new ApiError("problem", { status: 400, code: "INVALID_PHONE" }))).toBe("invalidPhone");
    expect(bookingErrorKind(new ApiError("network"))).toBe("failed");
    expect(bookingErrorKind(new Error())).toBe("failed");
  });

  it("has no text for taken and a text for the rest", () => {
    expect(bookingErrorText("taken")).toBeNull();
    expect(bookingErrorText("failed")).not.toBeNull();
  });
});
