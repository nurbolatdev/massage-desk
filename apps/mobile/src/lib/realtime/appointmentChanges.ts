import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/data/queryKeys";

export const CHANNEL_NAME = "appointments-changes";

export type ChangeFilter = { event: "*"; schema: "public"; table: "appointments" };

/** The part of a realtime channel this app uses. The payload of a change is never exposed. */
export type ChangeChannel = {
  on(filter: ChangeFilter, onEvent: () => void): void;
  subscribe(onStatus: (status: string) => void): void;
};

export type ChangeClient = {
  channel(name: string): ChangeChannel;
  removeChannel(channel: ChangeChannel): void;
};

const FILTER: ChangeFilter = { event: "*", schema: "public", table: "appointments" };

/**
 * Calls `onChange` on every change of the appointments table and on every successful
 * (re)subscription, so changes missed while disconnected are caught up. Returns the cleanup.
 */
export function subscribeAppointmentChanges(
  client: ChangeClient,
  onChange: () => void,
): () => void {
  let active = true;
  const notify = () => {
    if (active) onChange();
  };
  const channel = client.channel(CHANNEL_NAME);
  channel.on(FILTER, notify);
  channel.subscribe((status) => {
    if (status === "SUBSCRIBED") notify();
  });
  return () => {
    active = false;
    client.removeChannel(channel);
  };
}

export async function invalidateAppointments(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.appointments.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.slots.all }),
  ]);
}
