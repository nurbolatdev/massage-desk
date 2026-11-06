import { describe, expect, it } from "@jest/globals";

import { ApiError } from "@/lib/api/errors";

import {
  FORBIDDEN_TEXT,
  LOAD_ERROR_TEXT,
  freeTimeText,
  moreClientsTitle,
  nextClientLabel,
  offlineSavedText,
  refreshFailedSavedText,
  serviceLine,
  todayState,
  tomorrowText,
} from "./todayState";

describe("todayState", () => {
  it("offline with data shows the list and the banner", () => {
    const state = todayState({ online: false, hasData: true, error: null, appointmentsError: null });
    expect(state.view).toBe("list");
    expect(state.showOfflineBanner).toBe(true);
  });

  it("offline without data is offlineEmpty", () => {
    expect(todayState({ online: false, hasData: false, error: null, appointmentsError: null }).view).toBe("offlineEmpty");
  });

  it("online and pending is loading", () => {
    const state = todayState({ online: true, hasData: false, error: null, appointmentsError: null });
    expect(state.view).toBe("loading");
    expect(state.showOfflineBanner).toBe(false);
  });

  it("online error without data is the error view with a retry button", () => {
    const state = todayState({ online: true, hasData: false, error: new ApiError("server"), appointmentsError: new ApiError("server") });
    expect(state.view).toBe("error");
    expect(state.errorText).toBe(LOAD_ERROR_TEXT);
    expect(state.canRetry).toBe(true);
  });

  it("online error with data keeps the list and warns that the refresh failed", () => {
    const state = todayState({ online: true, hasData: true, error: new ApiError("network"), appointmentsError: new ApiError("network") });
    expect(state.view).toBe("list");
    expect(state.showOfflineBanner).toBe(false);
    expect(state.refreshFailed).toBe(true);
    expect(state.errorText).toBeNull();
  });

  it("forbidden with data keeps the list without a warning", () => {
    const state = todayState({ online: true, hasData: true, error: new ApiError("forbidden"), appointmentsError: new ApiError("forbidden") });
    expect(state.view).toBe("list");
    expect(state.refreshFailed).toBe(false);
    expect(state.errorText).toBeNull();
  });

  it("offline with data and an error shows only the offline banner", () => {
    const state = todayState({ online: false, hasData: true, error: new ApiError("network"), appointmentsError: new ApiError("network") });
    expect(state.showOfflineBanner).toBe(true);
    expect(state.refreshFailed).toBe(false);
  });

  it("offline without data and with an error is offlineEmpty", () => {
    const state = todayState({ online: false, hasData: false, error: new ApiError("network"), appointmentsError: new ApiError("network") });
    expect(state.view).toBe("offlineEmpty");
    expect(state.refreshFailed).toBe(false);
  });

  it("a settings-only error with data shows no refresh warning", () => {
    const state = todayState({
      online: true,
      hasData: true,
      error: new ApiError("server"),
      appointmentsError: null,
    });
    expect(state.view).toBe("list");
    expect(state.refreshFailed).toBe(false);
  });

  it("an appointments error with data online warns about the refresh", () => {
    const error = new ApiError("server");
    expect(todayState({ online: true, hasData: true, error, appointmentsError: error }).refreshFailed).toBe(true);
  });

  it("online with data and no error has no warning", () => {
    expect(todayState({ online: true, hasData: true, error: null, appointmentsError: null }).refreshFailed).toBe(false);
  });

  it("forbidden without data still gives the forbidden text and no retry", () => {
    const state = todayState({ online: true, hasData: false, error: new ApiError("forbidden"), appointmentsError: new ApiError("forbidden") });
    expect(state.errorText).toBe(FORBIDDEN_TEXT);
    expect(state.canRetry).toBe(false);
    expect(state.refreshFailed).toBe(false);
  });

  it("formats the refresh-failed saved time", () => {
    expect(refreshFailedSavedText("09:35")).toBe("Показано на 09:35");
  });

  it("forbidden shows its own text and no retry", () => {
    const state = todayState({ online: true, hasData: false, error: new ApiError("forbidden"), appointmentsError: new ApiError("forbidden") });
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

describe("nextClientLabel", () => {
  const now = new Date("2026-11-03T05:00:00Z");
  const ahead = (ms: number) => new Date(now.getTime() + ms);

  it("says how long until the next client", () => {
    expect(nextClientLabel(ahead(25 * 60_000), now)).toBe("Следующий клиент · через 25\u00a0мин");
    expect(nextClientLabel(ahead(90 * 60_000), now)).toBe("Следующий клиент · через 1,5\u00a0часа");
    expect(nextClientLabel(ahead(30_000), now)).toBe("Следующий клиент · через 1\u00a0мин");
  });

  it("says «сейчас» when in progress", () => {
    expect(nextClientLabel(ahead(-10 * 60_000), now)).toBe("Следующий клиент · сейчас");
  });
});

describe("text builders", () => {
  it("moreClientsTitle follows Russian plural rules", () => {
    expect(moreClientsTitle(1)).toBe("Ещё 1 клиент сегодня");
    expect(moreClientsTitle(2)).toBe("Ещё 2 клиента сегодня");
    expect(moreClientsTitle(5)).toBe("Ещё 5 клиентов сегодня");
    expect(moreClientsTitle(21)).toBe("Ещё 21 клиент сегодня");
  });

  it("freeTimeText", () => {
    expect(freeTimeText("14:30", 90)).toBe("Свободно до 14:30 · 1,5\u00a0часа");
  });

  it("serviceLine", () => {
    expect(serviceLine("Массаж спины", 60)).toBe("Массаж спины · 60\u00a0мин");
  });

  it("tomorrowText", () => {
    expect(tomorrowText(3, "9:00")).toBe("Завтра: 3 записи, первая в 9:00");
  });
});
