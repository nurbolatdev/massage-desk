import { createChunkedStorage, type ChunkStore } from "./chunkedStorage";

const MAX_BYTES = 2048;

const byteLength = (text: string) => new TextEncoder().encode(text).length;

function createFakeStore() {
  const data = new Map<string, string>();
  const store: ChunkStore = {
    getItemAsync: async (key) => data.get(key) ?? null,
    setItemAsync: async (key, value) => {
      if (!/^[A-Za-z0-9._-]+$/.test(key)) {
        throw new Error(`invalid key: ${key}`);
      }
      if (byteLength(value) > MAX_BYTES) {
        throw new Error(`value too large for ${key}`);
      }
      data.set(key, value);
    },
    deleteItemAsync: async (key) => {
      data.delete(key);
    },
  };
  return { store, data };
}

const KEY = "sb-ref-auth-token";

describe("createChunkedStorage", () => {
  it("returns null for a missing key", async () => {
    const { store } = createFakeStore();
    expect(await createChunkedStorage(store).getItem(KEY)).toBeNull();
  });

  it("round-trips a short value in one chunk", async () => {
    const { store, data } = createFakeStore();
    const storage = createChunkedStorage(store);
    await storage.setItem(KEY, "hello");
    expect(await storage.getItem(KEY)).toBe("hello");
    expect([...data.keys()].filter((k) => k !== `${KEY}.n`)).toEqual([`${KEY}.0`]);
  });

  it("round-trips a long ASCII value with every stored value within the limit", async () => {
    const { store, data } = createFakeStore();
    const storage = createChunkedStorage(store);
    const value = "a".repeat(10000);
    await storage.setItem(KEY, value);
    expect(await storage.getItem(KEY)).toBe(value);
    for (const stored of data.values()) {
      expect(byteLength(stored)).toBeLessThanOrEqual(MAX_BYTES);
    }
  });

  it("never splits a surrogate pair or a multi-byte character", async () => {
    const { store } = createFakeStore();
    const storage = createChunkedStorage(store);
    // One ASCII char first shifts the boundary so it lands inside a pair.
    const value = "x" + "Привет 😀 мир ".repeat(400) + "😀".repeat(900);
    await storage.setItem(KEY, value);
    expect(await storage.getItem(KEY)).toBe(value);
  });

  it("leaves no stale chunks when a long value is replaced by a short one", async () => {
    const { store, data } = createFakeStore();
    const storage = createChunkedStorage(store);
    await storage.setItem(KEY, "a".repeat(10000));
    await storage.setItem(KEY, "short");
    expect([...data.keys()].sort()).toEqual([`${KEY}.0`, `${KEY}.n`]);
    expect(await storage.getItem(KEY)).toBe("short");
  });

  it("removeItem empties the store", async () => {
    const { store, data } = createFakeStore();
    const storage = createChunkedStorage(store);
    await storage.setItem(KEY, "a".repeat(10000));
    await storage.removeItem(KEY);
    expect(data.size).toBe(0);
  });

  it("returns null when a middle chunk is missing", async () => {
    const { store, data } = createFakeStore();
    const storage = createChunkedStorage(store);
    await storage.setItem(KEY, "a".repeat(10000));
    data.delete(`${KEY}.2`);
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it("returns null when the count is missing", async () => {
    const { store, data } = createFakeStore();
    const storage = createChunkedStorage(store);
    await storage.setItem(KEY, "a".repeat(10000));
    data.delete(`${KEY}.n`);
    expect(await storage.getItem(KEY)).toBeNull();
  });

  it("returns null when the store throws on read", async () => {
    const { store } = createFakeStore();
    const failing: ChunkStore = {
      ...store,
      getItemAsync: async () => {
        throw new Error("keystore unavailable");
      },
    };
    expect(await createChunkedStorage(failing).getItem(KEY)).toBeNull();
  });
});
