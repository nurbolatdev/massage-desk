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

  const value = useMemo(() => ({ status, session, signOut }), [status, session, signOut]);

  return <AuthContext value={value}>{children}</AuthContext>;
}
