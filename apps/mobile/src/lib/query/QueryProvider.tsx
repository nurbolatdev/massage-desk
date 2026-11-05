import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsRestoring, useQueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider, type Persister } from "@tanstack/react-query-persist-client";
import { useEffect, useState, type ReactNode } from "react";

import { useSession } from "@/lib/auth/session";
import { AppointmentsRealtime } from "@/lib/realtime/AppointmentsRealtime";

import { connectFocusManager, connectOnlineManager } from "./online";
import { CACHE_MAX_AGE, CACHE_VERSION, createPersister, createQueryClient } from "./queryClient";

// Drops cached schedule data (memory and device storage) once the user is signed out. This also
// covers a leftover cache of another account at a cold start.
function CacheGuard({ persister }: { persister: Persister }) {
  const { status } = useSession();
  const queryClient = useQueryClient();
  const restoring = useIsRestoring();

  useEffect(() => {
    if (status !== "signedOut" || restoring) return;
    queryClient.clear();
    void persister.removeClient();
  }, [status, restoring, queryClient, persister]);

  return null;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  const [persister] = useState(() => createPersister(AsyncStorage));

  useEffect(() => {
    const disconnectOnline = connectOnlineManager();
    const disconnectFocus = connectFocusManager();
    return () => {
      disconnectOnline();
      disconnectFocus();
    };
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: CACHE_MAX_AGE, buster: CACHE_VERSION }}
    >
      <CacheGuard persister={persister} />
      <AppointmentsRealtime />
      {children}
    </PersistQueryClientProvider>
  );
}
