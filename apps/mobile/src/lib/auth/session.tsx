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

import { supabase } from "./supabase";

type Status = "loading" | "signedIn" | "signedOut";

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
    const apply = (next: Session | null) => {
      setSession(next);
      setStatus(next ? "signedIn" : "signedOut");
    };

    supabase.auth.getSession().then(({ data }) => {
      if (active) apply(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (active) apply(next);
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
    const { error } = await supabase.auth.signOut({ scope: "local" });
    return error === null;
  }, []);

  const value = useMemo(
    () => ({ status, session, signOut }),
    [status, session, signOut],
  );

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return value;
}
