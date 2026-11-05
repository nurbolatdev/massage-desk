import { describe, expect, it, jest } from "@jest/globals";
import { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/data/queryKeys";

import {
  invalidateAppointments,
  subscribeAppointmentChanges,
  type ChangeChannel,
  type ChangeClient,
  type ChangeFilter,
} from "./appointmentChanges";

function fakeClient() {
  const filters: ChangeFilter[] = [];
  let fireEvent: () => void = () => undefined;
  let fireStatus: (status: string) => void = () => undefined;
  const channel: ChangeChannel = {
    on: (filter, onEvent) => {
      filters.push(filter);
      fireEvent = onEvent;
    },
    subscribe: (onStatus) => {
      fireStatus = onStatus;
    },
  };
  const removed: ChangeChannel[] = [];
  const client: ChangeClient = {
    channel: () => channel,
    removeChannel: (c) => {
      removed.push(c);
    },
  };
  return {
    client,
    channel,
    filters,
    removed,
    event: () => fireEvent(),
    status: (s: string) => fireStatus(s),
  };
}

describe("subscribeAppointmentChanges", () => {
  it("listens to every change of the appointments table", () => {
    const fake = fakeClient();
    subscribeAppointmentChanges(fake.client, jest.fn());
    expect(fake.filters).toEqual([{ event: "*", schema: "public", table: "appointments" }]);
  });

  it("calls onChange once per change", () => {
    const fake = fakeClient();
    const onChange = jest.fn();
    subscribeAppointmentChanges(fake.client, onChange);
    fake.event();
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("calls onChange on every SUBSCRIBED but not on errors", () => {
    const fake = fakeClient();
    const onChange = jest.fn();
    subscribeAppointmentChanges(fake.client, onChange);
    fake.status("SUBSCRIBED");
    expect(onChange).toHaveBeenCalledTimes(1);
    fake.status("CHANNEL_ERROR");
    expect(onChange).toHaveBeenCalledTimes(1);
    fake.status("SUBSCRIBED");
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("removes the channel and ignores later events", () => {
    const fake = fakeClient();
    const onChange = jest.fn();
    const unsubscribe = subscribeAppointmentChanges(fake.client, onChange);
    unsubscribe();
    expect(fake.removed).toEqual([fake.channel]);
    fake.event();
    fake.status("SUBSCRIBED");
    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("invalidateAppointments", () => {
  it("invalidates appointment lists and leaves settings alone", async () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(queryKeys.appointments.range("2026-11-03", "2026-11-03"), []);
    queryClient.setQueryData(queryKeys.settings, {});
    await invalidateAppointments(queryClient);
    expect(
      queryClient.getQueryState(queryKeys.appointments.range("2026-11-03", "2026-11-03"))
        ?.isInvalidated,
    ).toBe(true);
    expect(queryClient.getQueryState(queryKeys.settings)?.isInvalidated).toBe(false);
    queryClient.clear();
  });
});
