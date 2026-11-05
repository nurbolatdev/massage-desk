import { describe, expect, it } from "@jest/globals";

import { ApiError } from "@/lib/api/errors";

import {
  FORBIDDEN_TEXT,
  LOAD_ERROR_TEXT,
  offlineSavedText,
  todayState,
} from "./todayState";

describe("todayState", () => {
  it("offline with data shows the list and the banner", () => {
    const state = todayState({ online: false, hasData: true, error: null });
    expect(state.view).toBe("list");
    expect(state.showOfflineBanner).toBe(true);
  });

  it("offline without data is offlineEmpty", () => {
    expect(todayState({ online: false, hasData: false, error: null }).view).toBe("offlineEmpty");
  });

  it("online and pending is loading", () => {
    const state = todayState({ online: true, hasData: false, error: null });
    expect(state.view).toBe("loading");
    expect(state.showOfflineBanner).toBe(false);
  });

  it("online error without data is the error view with a retry button", () => {
    const state = todayState({ online: true, hasData: false, error: new ApiError("server") });
    expect(state.view).toBe("error");
    expect(state.errorText).toBe(LOAD_ERROR_TEXT);
    expect(state.canRetry).toBe(true);
  });

  it("online error with data keeps the list without a banner", () => {
    const state = todayState({ online: true, hasData: true, error: new ApiError("network") });
    expect(state.view).toBe("list");
    expect(state.showOfflineBanner).toBe(false);
  });

  it("forbidden shows its own text and no retry", () => {
    const state = todayState({ online: true, hasData: false, error: new ApiError("forbidden") });
    expect(state.view).toBe("error");
    expect(state.errorText).toBe(FORBIDDEN_TEXT);
    expect(state.canRetry).toBe(false);
  });

  it("formats the saved time text", () => {
    expect(offlineSavedText("09:35")).toBe(
      "Показано расписание, сохранённое в 09:35. Изменения недоступны.",
    );
  });
});
