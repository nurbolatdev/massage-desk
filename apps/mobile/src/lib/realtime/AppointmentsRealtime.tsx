import type { RealtimeChannel } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { useSession } from "@/lib/auth/session";
import { supabase } from "@/lib/auth/supabase";

import {
  invalidateAppointments,
  subscribeAppointmentChanges,
  type ChangeChannel,
  type ChangeClient,
} from "./appointmentChanges";

// Adapts the Supabase client to the narrow interface used by the subscription.
function createChangeClient(): ChangeClient {
  const channels = new Map<ChangeChannel, RealtimeChannel>();
  return {
    channel(name) {
      const raw = supabase.channel(name);
      const channel: ChangeChannel = {
        on(filter, onEvent) {
          raw.on("postgres_changes", filter, () => onEvent());
        },
        subscribe(onStatus) {
          raw.subscribe((status) => onStatus(status));
        },
      };
      channels.set(channel, raw);
      return channel;
    },
    removeChannel(channel) {
      const raw = channels.get(channel);
      channels.delete(channel);
      if (raw) void supabase.removeChannel(raw);
    },
  };
}

/** Reloads the appointment lists when the table changes. Renders nothing. */
export function AppointmentsRealtime() {
  const { status, session } = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user.id ?? null;
  const live = status === "signedIn" && userId !== null;

  useEffect(() => {
    if (!live) return;
    return subscribeAppointmentChanges(createChangeClient(), () => {
      void invalidateAppointments(queryClient);
    });
  }, [live, userId, queryClient]);

  return null;
}
