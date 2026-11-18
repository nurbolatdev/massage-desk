import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { QueryClient } from "@tanstack/react-query";
import type { AsyncStorage } from "@tanstack/react-query-persist-client";

import { ApiError } from "@/lib/api/errors";

export const CACHE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;
// Bump when the shape of a cached response changes.
export const CACHE_VERSION = "1";

const MAX_ATTEMPTS = 3;

export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.kind !== "network" && error.kind !== "server") {
    return false;
  }
  return failureCount < MAX_ATTEMPTS;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Must not be shorter than the persister maxAge, or restored data is dropped early.
        gcTime: CACHE_MAX_AGE,
        retry: shouldRetry,
      },
    },
  });
}

export function createPersister(storage: AsyncStorage<string>) {
  return createAsyncStoragePersister({ storage });
}
