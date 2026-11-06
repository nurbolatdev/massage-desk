import { describe, expect, it } from "vitest";
import { AuthApiError, AuthRetryableFetchError } from "@supabase/supabase-js";

import {
  EMPTY_FIELDS_MESSAGE,
  GENERIC_MESSAGE,
  OFFLINE_MESSAGE,
  RATE_LIMIT_MESSAGE,
  WRONG_CREDENTIALS_MESSAGE,
  signInErrorMessage,
  validateSignIn,
} from "./signInErrors";

describe("validateSignIn", () => {
  it.each([
    ["", "x"],
    ["  ", "x"],
    ["a@b.kz", ""],
  ])("rejects empty input (%j, %j)", (email, password) => {
    expect(validateSignIn(email, password)).toEqual({ ok: false, message: EMPTY_FIELDS_MESSAGE });
  });

  it("trims the email", () => {
    expect(validateSignIn("  master@massagedesk.kz ", "pw")).toEqual({
      ok: true,
      email: "master@massagedesk.kz",
    });
  });
});

describe("signInErrorMessage", () => {
  it("explains wrong credentials", () => {
    const error = new AuthApiError("Invalid login credentials", 400, "invalid_credentials");
    expect(signInErrorMessage(error)).toBe(WRONG_CREDENTIALS_MESSAGE);
  });

  it("explains a 400 without a code as wrong credentials", () => {
    expect(signInErrorMessage(new AuthApiError("Invalid", 400, undefined))).toBe(WRONG_CREDENTIALS_MESSAGE);
  });

  it("explains rate limiting", () => {
    const error = new AuthApiError("Too many requests", 429, "over_request_rate_limit");
    expect(signInErrorMessage(error)).toBe(RATE_LIMIT_MESSAGE);
  });

  it("explains being offline", () => {
    expect(signInErrorMessage(new AuthRetryableFetchError("Failed to fetch", 0))).toBe(OFFLINE_MESSAGE);
  });

  it.each([[new Error("boom")], [null], ["text"], [new AuthApiError("x", 500, "unexpected_failure")]])(
    "falls back to the generic text for %j",
    (error) => {
      expect(signInErrorMessage(error)).toBe(GENERIC_MESSAGE);
    },
  );
});
