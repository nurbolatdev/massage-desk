import type { paths } from "@massage-desk/api-types";
import createClient from "openapi-fetch";

import { ApiError, toApiError } from "./errors";

export interface ApiOptions {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  onUnauthorized: () => void;
  fetch?: (input: Request) => Promise<Response>;
}

export function createApi({ baseUrl, getAccessToken, onUnauthorized, fetch }: ApiOptions) {
  const client = createClient<paths>({ baseUrl, fetch });

  client.use({
    async onRequest({ request }) {
      const token = await getAccessToken();
      // Offline with a not-yet-refreshed token: nothing is sent, and the caller
      // keeps its cached data. Never sign out because the token is missing.
      if (token === null) throw new ApiError("network");
      request.headers.set("Authorization", `Bearer ${token}`);
      return request;
    },
    onResponse({ response }) {
      if (response.status === 401) onUnauthorized();
    },
  });

  return client;
}

interface CallResult {
  data?: unknown;
  error?: unknown;
  response: Response;
}

function succeeded<R extends CallResult>(result: R): result is Extract<R, { data: unknown }> {
  return result.error === undefined;
}

/** Returns `data` of a successful call or throws an ApiError. */
export async function unwrap<R extends CallResult>(call: Promise<R>): Promise<Extract<R, { data: unknown }>["data"]> {
  let result: R;
  try {
    result = await call;
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError("network");
  }
  if (!succeeded(result)) throw toApiError(result.response.status, result.error);
  return result.data;
}
