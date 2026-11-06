import { isAuthRetryableFetchError, type AuthError, type Session } from "@supabase/supabase-js";

export type Status = "loading" | "signedIn" | "signedOut";

/** `signedIn` with `session: null` means offline with the token not yet refreshed; the API client must handle it. */
export type SessionState = { status: Exclude<Status, "loading">; session: Session | null };

/**
 * State for the first `getSession()` answer. An expired access token that cannot be
 * refreshed because the computer is offline keeps the user signed in: later
 * `TOKEN_REFRESHED` or `SIGNED_OUT` events settle it.
 */
export function sessionStateFrom(session: Session | null, error: AuthError | null): SessionState {
  if (session) return { status: "signedIn", session };
  if (error && isAuthRetryableFetchError(error)) return { status: "signedIn", session: null };
  return { status: "signedOut", session: null };
}

/** Local sign-out removes the stored session before the network call, so a network error still means "signed out". */
export function isLocalSignOutDone(error: AuthError | null): boolean {
  return error === null || isAuthRetryableFetchError(error);
}
