import { describe, expect, it } from "@jest/globals";
import { AuthApiError, AuthRetryableFetchError, type Session } from "@supabase/supabase-js";

import { sessionStateFrom, isLocalSignOutDone } from "./sessionLogic";

const session = { access_token: "a", refresh_token: "r" } as Session;

describe("sessionStateFrom", () => {
  it("is signed in when there is a session", () => {
    expect(sessionStateFrom(session, null)).toEqual({ status: "signedIn", session });
  });

  it("is signed out when there is no session and no error", () => {
    expect(sessionStateFrom(null, null)).toEqual({ status: "signedOut", session: null });
  });

  it("stays signed in when the refresh failed because the device is offline", () => {
    const error = new AuthRetryableFetchError("offline", 0);
    expect(sessionStateFrom(null, error)).toEqual({ status: "signedIn", session: null });
  });

  it("is signed out on a rejected refresh token", () => {
    const error = new AuthApiError("bad token", 400, "refresh_token_not_found");
    expect(sessionStateFrom(null, error)).toEqual({ status: "signedOut", session: null });
  });
});

describe("isLocalSignOutDone", () => {
  it("is done without an error", () => {
    expect(isLocalSignOutDone(null)).toBe(true);
  });

  it("is done on a network error", () => {
    expect(isLocalSignOutDone(new AuthRetryableFetchError("offline", 0))).toBe(true);
  });

  it("is not done on another error", () => {
    expect(isLocalSignOutDone(new AuthApiError("nope", 500, "unexpected_failure"))).toBe(false);
  });
});
