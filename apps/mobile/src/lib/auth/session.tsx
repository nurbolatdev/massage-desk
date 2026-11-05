import type { Session } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { sessionStateFrom, isLocalSignOutDone, type SessionState, type Status } from "./sessionLogic";
import { supabase } from "./supabase";

type SessionValue = {
  status: Status;
  session: Session | null;
  signOut: () => Promise<boolean>;
};

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    let active = true;
    const apply = (next: SessionState) => {
      setSession(next.session);
      setStatus(next.status);
    };

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active) apply(sessionStateFrom(data.session, error));
      })
      .catch(() => {
        if (active) apply(sessionStateFrom(null, null));
      });
    // The first state comes from getSession(); INITIAL_SESSION is ignored on purpose.
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active || event === "INITIAL_SESSION") return;
      apply(sessionStateFrom(next, null));
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const refresh = (state: string | null | undefined) => {
      if (state === "active") {
        void supabase.auth.startAutoRefresh();
      } else {
        void supabase.auth.stopAutoRefresh();
      }
    };
    refresh(AppState.currentState);
    const subscription = AppState.addEventListener("change", refresh);
    return () => {
      subscription.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (isLocalSignOutDone(error)) return true;
      const { data } = await supabase.auth.getSession();
      return data.session === null;
    } catch {
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({ status, session, signOut }),
    [status, session, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

/** `status` "signedIn" with `session: null` means offline, token not yet refreshed. */
export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return value;
}
