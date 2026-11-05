import { afterEach, describe, expect, it } from "@jest/globals";
import { persistQueryClientRestore, persistQueryClientSave } from "@tanstack/react-query-persist-client";

import { ApiError, type ApiErrorKind } from "@/lib/api/errors";

import { CACHE_MAX_AGE, CACHE_VERSION, createPersister, createQueryClient, shouldRetry } from "./queryClient";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

describe("shouldRetry", () => {
  it.each<ApiErrorKind>(["unauthorized", "forbidden", "problem"])("never retries %s", (kind) => {
    expect(shouldRetry(0, new ApiError(kind))).toBe(false);
  });

  it.each<ApiErrorKind>(["network", "server"])("retries %s up to 3 attempts", (kind) => {
    expect(shouldRetry(0, new ApiError(kind))).toBe(true);
    expect(shouldRetry(2, new ApiError(kind))).toBe(true);
    expect(shouldRetry(3, new ApiError(kind))).toBe(false);
  });
});

describe("persisted cache", () => {
  // Cached queries hold a gc timer; clearing the clients lets the test process exit.
  const clients: ReturnType<typeof createQueryClient>[] = [];
  function newClient() {
    const client = createQueryClient();
    clients.push(client);
    return client;
  }
  afterEach(() => {
    clients.splice(0).forEach((client) => client.clear());
  });

  const key = ["appointments", "2026-11-03", "2026-11-03"];

  async function saved() {
    const storage = memoryStorage();
    const persister = createPersister(storage);
    const client = newClient();
    client.setQueryData(key, [{ id: 1 }]);
    await persistQueryClientSave({ queryClient: client, persister, buster: CACHE_VERSION });
    return { persister, original: client };
  }

  it("keeps garbage collection at least as long as the max age", () => {
    expect(newClient().getDefaultOptions().queries?.gcTime).toBeGreaterThanOrEqual(CACHE_MAX_AGE);
  });

  it("restores data into a new client with the same update time", async () => {
    const { persister, original } = await saved();
    const next = newClient();
    await persistQueryClientRestore({
      queryClient: next,
      persister,
      maxAge: CACHE_MAX_AGE,
      buster: CACHE_VERSION,
    });
    expect(next.getQueryData(key)).toEqual([{ id: 1 }]);
    expect(next.getQueryState(key)?.dataUpdatedAt).toBe(original.getQueryState(key)?.dataUpdatedAt);
  });

  it("restores nothing for a different buster", async () => {
    const { persister } = await saved();
    const next = newClient();
    await persistQueryClientRestore({ queryClient: next, persister, maxAge: CACHE_MAX_AGE, buster: "2" });
    expect(next.getQueryData(key)).toBeUndefined();
  });

  it("restores nothing when older than the max age", async () => {
    const { persister } = await saved();
    const next = newClient();
    await persistQueryClientRestore({ queryClient: next, persister, maxAge: -1, buster: CACHE_VERSION });
    expect(next.getQueryData(key)).toBeUndefined();
  });
});
