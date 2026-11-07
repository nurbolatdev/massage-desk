import { localDay, nextDay } from "./days";
import { formatTime, NBSP } from "../format";

export const NEW_BOOKING_TITLE = "Новая запись";
export const CLOSE_LABEL = "Закрыть";
export const SERVICE_STEP = "2. Услуга";
export const TIME_STEP = "3. День и время";
export const TIME_STEP_SHORT = "День и время";
export const CHANGE_LABEL = "Изменить";
export const TODAY_LABEL = "Сегодня";
export const TOMORROW_LABEL = "Завтра";

export const SERVICES_EMPTY = "Услуг для записи пока нет.";
export const SERVICES_FAILED = "Не получилось загрузить услуги.";

export const PICK_SERVICE_FIRST = "Сначала выберите услугу.";
export const TIMES_EMPTY = "На этот день свободного времени нет. Выберите другой день.";
export const TIMES_FAILED = "Не получилось загрузить свободное время.";

export const CONFLICT_TEXT = "Пока вы выбирали, это время заняли. Выберите другое время.";
export const OUTSIDE_TEXT = "Это время уже нельзя записать. Выберите другое время.";
export const NOT_FOUND_BOOKING_TEXT = "Клиент или услуга больше недоступны. Выберите ещё раз.";
export const BOOK_FAILED = "Не получилось записать. Проверьте интернет и попробуйте ещё раз.";
export const BOOKING_OFFLINE_TEXT = "Записать клиента можно, когда телефон подключится к интернету.";

export const CHOOSE_CLIENT = "Выберите клиента";
export const CHECK_PHONE = "Проверьте номер телефона";
export const ENTER_NAME = "Напишите имя клиента";
export const CHOOSE_SERVICE = "Выберите услугу";
export const CHOOSE_TIME = "Выберите время";

/** How many days ahead the master can book, starting with today. */
export const BOOKING_DAYS = 8;

export function takenA11y(time: string): string {
  return `${time}, только что заняли`;
}

export function conflictTitle(time: string): string {
  return `${time} уже занято`;
}

export function bookLabel(when: string): string {
  return `Записать · ${when}`;
}

/** "60 мин" with a non-breaking space. */
export function serviceMeta(durationMin: number): string {
  return `${durationMin}${NBSP}мин`;
}

export type ShortDayParts = { weekday: string; day: string; month: string };

/** `{ weekday: "вт", day: "3", month: "нояб." }` in the given zone. */
export function shortDayParts(date: Date, timeZone: string): ShortDayParts {
  const parts = new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone,
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { weekday: part("weekday"), day: part("day"), month: part("month") };
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export type DayChoice = { day: string; label: string };

/** `count` days from `today`: «Сегодня», «Завтра», «Ср 4», … */
export function dayChoices(today: string, count: number): DayChoice[] {
  const result: DayChoice[] = [];
  let day = today;
  for (let i = 0; i < count; i += 1) {
    if (i === 0) {
      result.push({ day, label: TODAY_LABEL });
    } else if (i === 1) {
      result.push({ day, label: TOMORROW_LABEL });
    } else {
      const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" }).format(
        new Date(`${day}T12:00:00Z`),
      );
      const number = Number(day.slice(8, 10));
      result.push({ day, label: `${capitalise(weekday)} ${number}` });
    }
    day = nextDay(day);
  }
  return result;
}

/** «сегодня, 15:00» | «завтра, 15:00» | «ср, 4 нояб., 15:00» */
export function whenText(start: Date, today: string, timeZone: string): string {
  const time = formatTime(start, timeZone);
  const day = localDay(start, timeZone);
  if (day === today) return `сегодня, ${time}`;
  if (day === nextDay(today)) return `завтра, ${time}`;
  const { weekday, day: number, month } = shortDayParts(start, timeZone);
  return `${weekday}, ${number} ${month}, ${time}`;
}

export type ClientStatus = "none" | "invalidPhone" | "needsName" | "ready";

export type SubmitInput = {
  client: ClientStatus;
  serviceId: string | null;
  start: string | null;
  today: string;
  timeZone: string;
  online: boolean;
  busy: boolean;
};

/** The label of the submit button: the first missing piece, or «Записать · …». */
export function submitState(input: SubmitInput): { label: string; enabled: boolean } {
  if (input.client === "none") return { label: CHOOSE_CLIENT, enabled: false };
  if (input.client === "invalidPhone") return { label: CHECK_PHONE, enabled: false };
  if (input.client === "needsName") return { label: ENTER_NAME, enabled: false };
  if (input.serviceId === null) return { label: CHOOSE_SERVICE, enabled: false };
  if (input.start === null) return { label: CHOOSE_TIME, enabled: false };
  const label = bookLabel(whenText(new Date(input.start), input.today, input.timeZone));
  return { label, enabled: input.online && !input.busy };
}

export type TimeState = "free" | "selected" | "taken";
export type TimeChoice = { start: string; label: string; state: TimeState };

/** Free starts in time order; `taken` is shown struck and can never be selected. */
export function timeChoices(
  starts: string[],
  selected: string | null,
  taken: string | null,
  timeZone: string,
): TimeChoice[] {
  const all = taken !== null && !starts.includes(taken) ? [...starts, taken] : [...starts];
  return all
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    .map((start) => {
      const state: TimeState = start === taken ? "taken" : start === selected ? "selected" : "free";
      return { start, label: formatTime(new Date(start), timeZone), state };
    });
}

/** Splits `items` into rows of `size`. */
export function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/** 4 chip columns, 3 from a 120 % font up. */
export function chipColumns(fontScale: number): number {
  return fontScale >= 1.2 ? 3 : 4;
}
