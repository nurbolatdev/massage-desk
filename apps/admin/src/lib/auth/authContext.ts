import type { Session } from "@supabase/supabase-js";
import { createContext, useContext } from "react";

import type { Status } from "./sessionLogic";

export type AuthState = {
  status: Status;
  session: Session | null;
  signOut: () => Promise<boolean>;
  /** Re-reads the session; an expired token is refreshed on the way. */
  reloadSession: () => Promise<void>;
};

export const AuthContext = createContext<AuthState | null>(null);

/** `status` "signedIn" with `session: null` means offline, token not yet refreshed. */
export function useAuth(): AuthState {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
