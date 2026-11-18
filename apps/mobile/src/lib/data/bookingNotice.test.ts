import { afterEach, describe, expect, it, jest } from "@jest/globals";

import {
  clearBookingNotice,
  firstName,
  getBookingNotice,
  noticeText,
  showBookingNotice,
  subscribeBookingNotice,
} from "./bookingNotice";

const notice = {
  appointmentId: "a1",
  clientName: "Айгуль Сапарова",
  start: new Date("2026-11-03T10:00:00Z"),
};

afterEach(() => {
  clearBookingNotice();
});

describe("noticeText", () => {
  it("names the client, the time and that no message is sent", () => {
    expect(noticeText(notice, "Asia/Tashkent")).toBe(
      "Айгуль, вт 3 нояб., 15:00. Клиенту сообщение не придёт.",
    );
  });
});

describe("firstName", () => {
  it("keeps a phone whole", () => {
    expect(firstName("+998901234567")).toBe("+998901234567");
  });

  it("takes the first word of a name", () => {
    expect(firstName("Айгуль Сапарова")).toBe("Айгуль");
  });
});

describe("booking notice store", () => {
  it("notifies listeners and returns the notice", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeBookingNotice(listener);
    showBookingNotice(notice);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(getBookingNotice()).toBe(notice);
    unsubscribe();
  });

  it("clears to null", () => {
    showBookingNotice(notice);
    clearBookingNotice();
    expect(getBookingNotice()).toBeNull();
  });

  it("does not call an unsubscribed listener", () => {
    const listener = jest.fn();
    const unsubscribe = subscribeBookingNotice(listener);
    unsubscribe();
    showBookingNotice(notice);
    expect(listener).not.toHaveBeenCalled();
  });
});
