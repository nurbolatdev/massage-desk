import type { Session } from "@supabase/supabase-js";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { AuthContext } from "./authContext";
import { sessionStateFrom, isLocalSignOutDone, type SessionState, type Status } from "./sessionLogic";
import { supabase } from "./supabase";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");
  const [session, setSession] = useState<Session | null>(null);

  const apply = useCallback((next: SessionState) => {
    setSession(next.session);
    setStatus(next.status);
  }, []);

  useEffect(() => {
    let active = true;

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
  }, [apply]);

  const reloadSession = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      apply(sessionStateFrom(data.session, error));
    } catch {
      // Still offline: keep the current state so the retry card stays.
    }
  }, [apply]);

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

  const value = useMemo(() => ({ status, session, signOut, reloadSession }), [status, session, signOut, reloadSession]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
