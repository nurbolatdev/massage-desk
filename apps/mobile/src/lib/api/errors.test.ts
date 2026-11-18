import { describe, expect, it } from "@jest/globals";

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

  it("keeps valid conflicts in order and drops malformed ones", () => {
    const a = { appointmentId: "a1", clientName: "Ержан", start: "2026-12-15T11:00:00+05:00", end: "2026-12-15T12:00:00+05:00" };
    const b = { appointmentId: "a2", clientName: null, start: "2026-12-16T11:00:00+05:00", end: "2026-12-16T12:00:00+05:00" };
    const error = toApiError(409, {
      code: "APPOINTMENT_CONFLICT",
      conflicts: [a, { appointmentId: 5 }, "x", b],
    });
    expect(error.conflicts).toEqual([a, b]);
    expect(error.message).toBe("problem");
  });

  it("has no conflicts without the field", () => {
    expect(toApiError(409, { code: "APPOINTMENT_CONFLICT" }).conflicts).toBeUndefined();
    expect(toApiError(409, { code: "APPOINTMENT_CONFLICT", conflicts: "x" }).conflicts).toBeUndefined();
  });

  it("is an Error with the kind", () => {
    expect(new ApiError("network")).toBeInstanceOf(Error);
  });
});
