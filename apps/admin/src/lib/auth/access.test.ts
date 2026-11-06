import { describe, expect, it } from "vitest";

import { roleFromProfile } from "./access";

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
