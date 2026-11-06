import { describe, expect, it } from "vitest";

import { accessView, roleFromProfile } from "./access";

describe("roleFromProfile", () => {
  it("accepts admin and master", () => {
    expect(roleFromProfile({ role: "admin" })).toBe("admin");
    expect(roleFromProfile({ role: "master" })).toBe("master");
  });

  it("ignores extra fields", () => {
    expect(roleFromProfile({ role: "admin", extra: 1 })).toBe("admin");
  });

  it.each([[{ role: "owner" }], [{ role: 1 }], [null], ["admin"], [{}], [undefined]])(
    "returns null for %j",
    (row) => {
      expect(roleFromProfile(row)).toBeNull();
    },
  );
});

describe("accessView", () => {
  const base = { hasSession: true, isPending: false, isError: false, role: "admin" as const };

  it("shows offline when signed in without a session", () => {
    expect(accessView({ ...base, hasSession: false, isPending: true, role: undefined })).toBe("offline");
  });

  it("shows loading while the role is loading", () => {
    expect(accessView({ ...base, isPending: true, role: undefined })).toBe("loading");
  });

  it("shows error when the role request failed", () => {
    expect(accessView({ ...base, isError: true, role: undefined })).toBe("error");
  });

  it("denies access without a role", () => {
    expect(accessView({ ...base, role: null })).toBe("denied");
  });

  it("allows a known role", () => {
    expect(accessView(base)).toBe("allowed");
    expect(accessView({ ...base, role: "master" })).toBe("allowed");
  });
});
