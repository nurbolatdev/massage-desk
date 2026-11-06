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
});
