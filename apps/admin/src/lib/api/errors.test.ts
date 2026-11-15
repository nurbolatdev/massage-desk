import { describe, expect, it } from "vitest";

import { ApiError, toApiError } from "./errors";

describe("toApiError", () => {
  it("maps 401 and 403 by status", () => {
    expect(toApiError(401, "").kind).toBe("unauthorized");
    expect(toApiError(403, null).kind).toBe("forbidden");
  });

  it("maps a 4xx problem body to its code", () => {
    const error = toApiError(404, { code: "CLIENT_NOT_FOUND", detail: "secret" });
    expect(error.kind).toBe("problem");
    expect(error.code).toBe("CLIENT_NOT_FOUND");
    expect(error.message).not.toContain("secret");
  });

  it("treats a 4xx without a code as server", () => {
    expect(toApiError(400, null).kind).toBe("server");
    expect(toApiError(400, { title: "x" }).kind).toBe("server");
    expect(toApiError(400, { code: 5 }).kind).toBe("server");
  });

  it("maps 5xx to server", () => {
    expect(toApiError(500, "<html>").kind).toBe("server");
    expect(toApiError(500, { code: "TIME_TAKEN" }).kind).toBe("server");
  });

  it("is an Error with the kind", () => {
    expect(new ApiError("network")).toBeInstanceOf(Error);
  });

  it("extracts appointment conflicts from a 4xx problem", () => {
    const conflicts = [
      {
        appointmentId: "a1",
        clientName: null,
        start: "2026-11-07T10:00:00+05:00",
        end: "2026-11-07T11:00:00+05:00",
      },
    ];
    const error = toApiError(409, { code: "APPOINTMENT_CONFLICT", conflicts });
    expect(error.kind).toBe("problem");
    expect(error.code).toBe("APPOINTMENT_CONFLICT");
    expect(error.conflicts).toEqual(conflicts);
  });

  it("filters out malformed conflict items", () => {
    const valid = {
      appointmentId: "a1",
      clientName: "Айгуль",
      start: "2026-11-07T10:00:00+05:00",
      end: "2026-11-07T11:00:00+05:00",
    };
    const error = toApiError(409, {
      code: "APPOINTMENT_CONFLICT",
      conflicts: [
        { appointmentId: "a2", clientName: null, end: "2026-11-07T11:00:00+05:00" },
        { ...valid, appointmentId: "a3", clientName: 5 },
        valid,
      ],
    });
    expect(error.conflicts).toEqual([valid]);
  });

  it("leaves conflicts undefined when absent, non-array, or 5xx", () => {
    expect(toApiError(409, { code: "APPOINTMENT_CONFLICT" }).conflicts).toBeUndefined();
    expect(
      toApiError(409, { code: "APPOINTMENT_CONFLICT", conflicts: "bad" }).conflicts,
    ).toBeUndefined();

    const serverError = toApiError(500, {
      code: "APPOINTMENT_CONFLICT",
      conflicts: [
        {
          appointmentId: "a1",
          clientName: null,
          start: "2026-11-07T10:00:00+05:00",
          end: "2026-11-07T11:00:00+05:00",
        },
      ],
    });
    expect(serverError.kind).toBe("server");
    expect(serverError.conflicts).toBeUndefined();
  });

  it("stores conflicts passed to the ApiError constructor", () => {
    const conflicts = [
      {
        appointmentId: "a1",
        clientName: "Айгуль",
        start: "2026-11-07T10:00:00+05:00",
        end: "2026-11-07T11:00:00+05:00",
      },
    ];
    expect(new ApiError("problem", { status: 409, conflicts }).conflicts).toEqual(conflicts);
  });
});
