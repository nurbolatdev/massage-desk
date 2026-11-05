import { afterEach, describe, expect, it, jest } from "@jest/globals";
import { onlineManager, QueryClient, QueryObserver } from "@tanstack/react-query";
import { persistQueryClientRestore, persistQueryClientSave } from "@tanstack/react-query-persist-client";

import { createApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { createPersister, createQueryClient, CACHE_MAX_AGE, CACHE_VERSION } from "@/lib/query/queryClient";
import {
  invalidateAppointments,
  subscribeAppointmentChanges,
  type ChangeChannel,
  type ChangeFilter,
} from "@/lib/realtime/appointmentChanges";

import { fetchAppointments, type AppointmentListItem } from "./appointments";
import { queryKeys } from "./queryKeys";

const DAY = "2026-11-03";

function makeItem(id: string, start: string): AppointmentListItem {
  return {
    id,
    clientId: "c1",
    clientName: "Анна",
    clientPhone: "+998901234567",
    serviceId: "s1",
    serviceName: "Классический массаж",
    start,
    end: start,
    status: "confirmed",
    source: "bot",
  };
}

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

function setup(options: { token?: string | null; status?: number } = {}) {
  const server = { list: [makeItem("a1", "2026-11-03T10:00:00+05:00")] };
  const state = { token: options.token === undefined ? "tok" : options.token };
  const fetch = jest.fn<(input: Request) => Promise<Response>>(async () => {
    if (options.status !== undefined) return new Response(null, { status: options.status });
    return new Response(JSON.stringify(server.list), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  const onUnauthorized = jest.fn();
  const api = createApi({
    baseUrl: "https://api.test",
    getAccessToken: async () => state.token,
    onUnauthorized,
    fetch,
  });
  return { server, state, fetch, onUnauthorized, api };
}

function fakeChannel() {
  let onEvent: () => void = () => undefined;
  let onStatus: (status: string) => void = () => undefined;
  const channel: ChangeChannel = {
    on(_filter: ChangeFilter, handler) {
      onEvent = handler;
    },
    subscribe(handler) {
      onStatus = handler;
    },
  };
  const client = { channel: () => channel, removeChannel: () => undefined };
  return { client, change: () => onEvent(), status: (s: string) => onStatus(s) };
}

type Observer = QueryObserver<AppointmentListItem[], Error>;
type Result = ReturnType<Observer["getCurrentResult"]>;

function observe(
  client: QueryClient,
  api: ReturnType<typeof setup>["api"],
  extra: { retry?: false } = {},
): Observer {
  return new QueryObserver<AppointmentListItem[], Error>(client, {
    queryKey: queryKeys.appointments.range(DAY, DAY),
    queryFn: () => fetchAppointments(api, DAY, DAY),
    ...extra,
  });
}

function waitFor(observer: Observer, done: (result: Result) => boolean): Promise<Result> {
  return new Promise((resolve) => {
    const check = (result: Result) => {
      if (done(result)) {
        unsubscribe();
        resolve(result);
        return true;
      }
      return false;
    };
    const unsubscribe = observer.subscribe((result) => void check(result));
    check(observer.getCurrentResult());
  });
}

describe("data layer", () => {
  const clients: QueryClient[] = [];
  const stops: (() => void)[] = [];
  function newClient() {
    const client = createQueryClient();
    clients.push(client);
    return client;
  }
  afterEach(() => {
    onlineManager.setOnline(true);
    stops.splice(0).forEach((stop) => stop());
    clients.splice(0).forEach((client) => client.clear());
  });

  it("refetches at once when a change event arrives", async () => {
    const { server, fetch, api } = setup();
    const client = newClient();
    const observer = observe(client, api);
    const first = await waitFor(observer, (r) => r.data !== undefined);
    expect(first.data).toHaveLength(1);
    // Keep the query active while the event arrives.
    stops.push(observer.subscribe(() => undefined));

    const channel = fakeChannel();
    stops.push(subscribeAppointmentChanges(channel.client, () => void invalidateAppointments(client)));

    server.list = [...server.list, makeItem("a2", "2026-11-03T12:00:00+05:00")];
    expect(fetch).toHaveBeenCalledTimes(1);
    channel.change();
    const second = await waitFor(observer, (r) => r.data?.length === 2);
    expect(second.data).toHaveLength(2);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("restores the saved schedule offline without a network call", async () => {
    const storage = memoryStorage();
    const persister = createPersister(storage);
    const online = setup();
    const source = newClient();
    await waitFor(observe(source, online.api), (r) => r.data !== undefined);
    await persistQueryClientSave({ queryClient: source, persister, buster: CACHE_VERSION });

    onlineManager.setOnline(false);
    const offline = setup();
    const restored = newClient();
    await persistQueryClientRestore({
      queryClient: restored,
      persister,
      maxAge: CACHE_MAX_AGE,
      buster: CACHE_VERSION,
    });
    const observer = observe(restored, offline.api);
    stops.push(observer.subscribe(() => undefined));
    const result = observer.getCurrentResult();
    expect(result.data).toHaveLength(1);
    expect(result.fetchStatus).not.toBe("fetching");
    expect(offline.fetch).not.toHaveBeenCalled();
  });

  it("signs out once on 401 and does not retry", async () => {
    const { fetch, onUnauthorized, api } = setup({ status: 401 });
    const result = await waitFor(observe(newClient(), api), (r) => r.status === "error");
    expect(result.error).toBeInstanceOf(ApiError);
    expect(result.error instanceof ApiError && result.error.kind).toBe("unauthorized");
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("does not call the network without a token and recovers when it appears", async () => {
    const { state, fetch, api } = setup({ token: null });
    const observer = observe(newClient(), api, { retry: false });
    const failed = await waitFor(observer, (r) => r.status === "error");
    expect(failed.error instanceof ApiError && failed.error.kind).toBe("network");
    expect(fetch).not.toHaveBeenCalled();

    state.token = "tok";
    const again = await observer.refetch();
    expect(again.data).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
