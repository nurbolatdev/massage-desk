import { describe, expect, it } from "vitest";

import { createRememberStorage, type KeyValueStore } from "./rememberStorage";

function fakeStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

function setup() {
  const local = fakeStore();
  const session = fakeStore();
  return { local, session, ...createRememberStorage(local, session) };
}

describe("createRememberStorage", () => {
  it("returns null for a missing key", () => {
    expect(setup().storage.getItem("k")).toBeNull();
  });

  it("writes only to local after setRemember(true)", () => {
    const { local, session, storage, setRemember } = setup();
    setRemember(true);
    storage.setItem("k", "v");
    expect(local.data.get("k")).toBe("v");
    expect(session.data.has("k")).toBe(false);
  });

  it("writes only to session after setRemember(false)", () => {
    const { local, session, storage, setRemember } = setup();
    setRemember(false);
    storage.setItem("k", "v");
    expect(session.data.get("k")).toBe("v");
    expect(local.data.has("k")).toBe(false);
  });

  it("moves the value when the choice changes from true to false", () => {
    const { local, session, storage, setRemember } = setup();
    setRemember(true);
    storage.setItem("k", "one");
    setRemember(false);
    storage.setItem("k", "two");
    expect(session.data.get("k")).toBe("two");
    expect(local.data.has("k")).toBe(false);
  });

  it("keeps a refresh write in session when the key is already there", () => {
    const { local, session, storage } = setup();
    session.setItem("k", "old");
    storage.setItem("k", "new");
    expect(session.data.get("k")).toBe("new");
    expect(local.data.has("k")).toBe(false);
  });

  it("writes to local when there is no choice and no key", () => {
    const { local, session, storage } = setup();
    storage.setItem("k", "v");
    expect(local.data.get("k")).toBe("v");
    expect(session.data.has("k")).toBe(false);
  });

  it("prefers local on read", () => {
    const { local, session, storage } = setup();
    local.setItem("k", "from-local");
    session.setItem("k", "from-session");
    expect(storage.getItem("k")).toBe("from-local");
  });

  it("clears both stores on remove", () => {
    const { local, session, storage } = setup();
    local.setItem("k", "a");
    session.setItem("k", "b");
    storage.removeItem("k");
    expect(local.data.has("k")).toBe(false);
    expect(session.data.has("k")).toBe(false);
  });

  it("treats a throwing store as empty", () => {
    const session = fakeStore();
    session.setItem("k", "v");
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    const { storage } = createRememberStorage(broken, session);
    expect(storage.getItem("k")).toBe("v");
    expect(createRememberStorage(broken, broken).storage.getItem("k")).toBeNull();
  });
});
