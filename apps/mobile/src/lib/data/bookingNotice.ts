import { useSyncExternalStore } from "react";

import { formatTime } from "../format";
import { shortDayParts } from "./newBooking";

export const BOOK_CLIENT_LABEL = "Записать клиента";
export const NOTICE_TITLE = "Записано";
/** How long the «Записано» notice stays on Today and Calendar. */
export const NOTICE_MS = 15_000;

export type BookingNotice = { appointmentId: string; clientName: string; start: Date };

/** The first word of a name; a phone (no letters) stays whole. */
export function firstName(name: string): string {
  const trimmed = name.trim();
  if (!/\p{L}/u.test(trimmed)) return trimmed;
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

/** "Айгуль, вт 3 нояб., 15:00. Клиенту сообщение не придёт." */
export function noticeText(notice: BookingNotice, timeZone: string): string {
  const { weekday, day, month } = shortDayParts(notice.start, timeZone);
  const time = formatTime(notice.start, timeZone);
  return `${firstName(notice.clientName)}, ${weekday} ${day} ${month}, ${time}. Клиенту сообщение не придёт.`;
}

let current: BookingNotice | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function showBookingNotice(notice: BookingNotice): void {
  current = notice;
  emit();
}

export function clearBookingNotice(): void {
  if (current === null) return;
  current = null;
  emit();
}

export function getBookingNotice(): BookingNotice | null {
  return current;
}

export function subscribeBookingNotice(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useBookingNotice(): BookingNotice | null {
  return useSyncExternalStore(subscribeBookingNotice, getBookingNotice);
}
